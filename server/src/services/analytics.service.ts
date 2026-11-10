import { Prisma, type IncidentCategory, type IncidentStatus, type Priority, type Severity, type TeamCategory } from "@prisma/client";
import type { AnalyticsDTO } from "../domain/contract.js";
import * as E from "../domain/enums.js";
import { toActivityDTO } from "../domain/mapper.js";
import { prisma } from "../lib/prisma.js";
import type { AnalyticsQuery } from "../schemas/incident.schemas.js";

interface TotalsRow {
  total: number;
  open: number;
  critical_open: number;
  critical_priority_open: number;
  pending: number;
  assigned: number;
  in_progress: number;
  resolved: number;
  awaiting_verification: number;
  avg_first: number | null;
  median_first: number | null;
  p90_first: number | null;
  avg_resolve: number | null;
  median_resolve: number | null;
}

const num = (v: number | null) => (v == null ? null : Math.round(Number(v)));
const DAY = 86_400_000;

/**
 * Dashboard statistics. Every figure comes from database rows; filters apply
 * to all incident metrics. Team figures always describe the current roster.
 */
export async function analytics(query: AnalyticsQuery): Promise<AnalyticsDTO> {
  const to = query.to ?? new Date();
  const from = query.from ?? new Date(to.getTime() - 30 * DAY);

  // Shared WHERE for raw SQL and Prisma queries.
  const sqlWhere = Prisma.sql`
    i."deletedAt" IS NULL
    ${query.category?.length ? Prisma.sql`AND i.category::text IN (${Prisma.join(query.category)})` : Prisma.empty}
    ${query.priority?.length ? Prisma.sql`AND i.priority::text IN (${Prisma.join(query.priority)})` : Prisma.empty}
    ${query.status?.length ? Prisma.sql`AND i.status::text IN (${Prisma.join(query.status)})` : Prisma.empty}
    ${query.location ? Prisma.sql`AND i."locationText" ILIKE ${`%${query.location.replace(/[%_]/g, "\\$&")}%`}` : Prisma.empty}`;
  const inRange = Prisma.sql`${sqlWhere} AND i."createdAt" BETWEEN ${from} AND ${to}`;
  const where: Prisma.IncidentWhereInput = {
    deletedAt: null,
    createdAt: { gte: from, lte: to },
    ...(query.category?.length && { category: { in: query.category } }),
    ...(query.priority?.length && { priority: { in: query.priority } }),
    ...(query.status?.length && { status: { in: query.status } }),
    ...(query.location && { locationText: { contains: query.location, mode: "insensitive" } }),
  };

  const weekStart = new Date(to.getTime() - 7 * 7 * DAY);

  const [totalsRows, byCategory, byStatus, bySeverity, byPriority, teams, assignTimes, daily, weekly, recent] =
    await Promise.all([
      prisma.$queryRaw<TotalsRow[]>`
        SELECT
          count(*)::int AS total,
          (count(*) FILTER (WHERE status <> 'RESOLVED'))::int AS open,
          (count(*) FILTER (WHERE status <> 'RESOLVED' AND "currentSeverity" = 'CRITICAL'))::int AS critical_open,
          (count(*) FILTER (WHERE status <> 'RESOLVED' AND priority = 'CRITICAL'))::int AS critical_priority_open,
          (count(*) FILTER (WHERE status = 'PENDING'))::int AS pending,
          (count(*) FILTER (WHERE "assignedTeamId" IS NOT NULL))::int AS assigned,
          (count(*) FILTER (WHERE status = 'IN_PROGRESS'))::int AS in_progress,
          (count(*) FILTER (WHERE status = 'RESOLVED'))::int AS resolved,
          (count(*) FILTER (WHERE verification <> 'VERIFIED' AND status <> 'RESOLVED'))::int AS awaiting_verification,
          avg(extract(epoch FROM "firstResponseAt" - "createdAt")) AS avg_first,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "firstResponseAt" - "createdAt")) AS median_first,
          percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM "firstResponseAt" - "createdAt")) AS p90_first,
          avg(extract(epoch FROM "resolvedAt" - "createdAt")) AS avg_resolve,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "resolvedAt" - "createdAt")) AS median_resolve
        FROM "Incident" i
        WHERE ${inRange}
      `,
      prisma.incident.groupBy({ by: ["category"], where, _count: { _all: true } }),
      prisma.incident.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.incident.groupBy({ by: ["currentSeverity"], where, _count: { _all: true } }),
      prisma.incident.groupBy({ by: ["priority"], where, _count: { _all: true } }),
      prisma.responseTeam.groupBy({ by: ["category", "availability"], where: { deletedAt: null }, _count: { _all: true } }),
      // Time from report to the FIRST assignment of each incident.
      prisma.$queryRaw<{ avg_assign: number | null }[]>`
        SELECT avg(extract(epoch FROM a.first_at - i."createdAt")) AS avg_assign
        FROM "Incident" i
        JOIN (SELECT "incidentId", min("assignedAt") AS first_at FROM "TeamAssignment" GROUP BY "incidentId") a
          ON a."incidentId" = i.id
        WHERE ${inRange}
      `,
      prisma.$queryRaw<{ date: Date; reported: number; resolved: number }[]>`
        SELECT d::date AS date,
               (SELECT count(*)::int FROM "Incident" i WHERE ${sqlWhere} AND i."createdAt" >= d AND i."createdAt" < d + interval '1 day') AS reported,
               (SELECT count(*)::int FROM "Incident" i WHERE ${sqlWhere} AND i."resolvedAt" >= d AND i."resolvedAt" < d + interval '1 day') AS resolved
        FROM generate_series(date_trunc('day', ${from}::timestamp), date_trunc('day', ${to}::timestamp), interval '1 day') AS d
        ORDER BY d
      `,
      prisma.$queryRaw<{ week: Date; reported: number; resolved: number }[]>`
        SELECT w::date AS week,
               (SELECT count(*)::int FROM "Incident" i WHERE ${sqlWhere} AND i."createdAt" >= w AND i."createdAt" < w + interval '7 days') AS reported,
               (SELECT count(*)::int FROM "Incident" i WHERE ${sqlWhere} AND i."resolvedAt" >= w AND i."resolvedAt" < w + interval '7 days') AS resolved
        FROM generate_series(date_trunc('week', ${weekStart}::timestamp), date_trunc('week', ${to}::timestamp), interval '7 days') AS w
        ORDER BY w
      `,
      prisma.incidentUpdate.findMany({
        where: { incident: { deletedAt: null } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          actor: { select: { id: true, name: true, role: true } },
          incident: { select: { id: true, trackingCode: true } },
        },
      }),
    ]);

  const t = totalsRows[0]!;
  const countOf = (rows: object[], match: Record<string, string>) =>
    (rows as ({ _count: { _all: number } } & Record<string, unknown>)[])
      .filter((r) => Object.entries(match).every(([k, v]) => r[k] === v))
      .reduce((sum, r) => sum + r._count._all, 0);
  const availableTeams = countOf(teams, { availability: "AVAILABLE" });
  const busyTeams = countOf(teams, { availability: "BUSY" });

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      total: t.total,
      criticalPriorityOpen: t.critical_priority_open,
      assigned: t.assigned,
      availableTeams,
      busyTeams,
      open: t.open,
      criticalOpen: t.critical_open,
      pending: t.pending,
      inProgress: t.in_progress,
      resolved: t.resolved,
      awaitingVerification: t.awaiting_verification,
    },
    responseTimes: {
      avgFirstResponseSec: num(t.avg_first),
      medianFirstResponseSec: num(t.median_first),
      p90FirstResponseSec: num(t.p90_first),
      avgResolutionSec: num(t.avg_resolve),
      medianResolutionSec: num(t.median_resolve),
    },
    responseTeams: { avgAssignSec: num(assignTimes[0]?.avg_assign ?? null) },
    byPriority: (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((p) => ({
      name: E.priority.toLabel(p),
      count: countOf(byPriority, { priority: p }),
    })),
    teamAvailability: (["FIRE", "MEDICAL", "RESCUE", "POLICE", "DISASTER_RELIEF"] as TeamCategory[]).map((c) => ({
      name: E.teamCategory.toLabel(c),
      Available: countOf(teams, { category: c, availability: "AVAILABLE" }),
      Busy: countOf(teams, { category: c, availability: "BUSY" }),
    })),
    weekly: weekly.map((w) => ({ week: w.week.toISOString().slice(0, 10), reported: w.reported, resolved: w.resolved })),
    byCategory: (
      ["FIRE", "ROAD_ACCIDENT", "MEDICAL_EMERGENCY", "FLOOD", "BUILDING_COLLAPSE", "OTHER"] as IncidentCategory[]
    ).map((c) => ({ name: E.category.toLabel(c), count: countOf(byCategory, { category: c }) })),
    byStatus: (["REPORTED", "PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED"] as IncidentStatus[]).map((s) => ({
      name: E.status.toLabel(s),
      value: countOf(byStatus, { status: s }),
    })),
    bySeverity: (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[]).map((s) => ({
      name: E.severity.toLabel(s),
      count: countOf(bySeverity, { currentSeverity: s }),
    })),
    daily: daily.map((d) => ({ date: d.date.toISOString().slice(0, 10), reported: d.reported, resolved: d.resolved })),
    recentActivity: recent.map((a) => ({
      ...toActivityDTO(a),
      incidentId: a.incident.id,
      reference: a.incident.trackingCode,
    })),
  };
}
