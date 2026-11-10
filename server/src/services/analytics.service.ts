import type { IncidentCategory, IncidentStatus, Severity } from "@prisma/client";
import type { AnalyticsDTO } from "../domain/contract.js";
import * as E from "../domain/enums.js";
import { toActivityDTO } from "../domain/mapper.js";
import { prisma } from "../lib/prisma.js";

interface TotalsRow {
  total: number;
  open: number;
  critical_open: number;
  pending: number;
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

/** Dashboard statistics for DashboardPage.tsx. Defaults to the last 30 days. */
export async function analytics(range: { from?: Date; to?: Date }): Promise<AnalyticsDTO> {
  const to = range.to ?? new Date();
  const from = range.from ?? new Date(to.getTime() - 30 * 86_400_000);
  const where = { deletedAt: null, createdAt: { gte: from, lte: to } };

  const [totalsRows, byCategory, byStatus, bySeverity, daily, recent] = await Promise.all([
    prisma.$queryRaw<TotalsRow[]>`
      SELECT
        count(*)::int AS total,
        (count(*) FILTER (WHERE status <> 'RESOLVED'))::int AS open,
        (count(*) FILTER (WHERE status <> 'RESOLVED' AND "currentSeverity" = 'CRITICAL'))::int AS critical_open,
        (count(*) FILTER (WHERE status = 'PENDING'))::int AS pending,
        (count(*) FILTER (WHERE status = 'IN_PROGRESS'))::int AS in_progress,
        (count(*) FILTER (WHERE status = 'RESOLVED'))::int AS resolved,
        (count(*) FILTER (WHERE verification <> 'VERIFIED' AND status <> 'RESOLVED'))::int AS awaiting_verification,
        avg(extract(epoch FROM "firstResponseAt" - "createdAt")) AS avg_first,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "firstResponseAt" - "createdAt")) AS median_first,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM "firstResponseAt" - "createdAt")) AS p90_first,
        avg(extract(epoch FROM "resolvedAt" - "createdAt")) AS avg_resolve,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "resolvedAt" - "createdAt")) AS median_resolve
      FROM "Incident"
      WHERE "deletedAt" IS NULL AND "createdAt" BETWEEN ${from} AND ${to}
    `,
    prisma.incident.groupBy({ by: ["category"], where, _count: { _all: true } }),
    prisma.incident.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.incident.groupBy({ by: ["currentSeverity"], where, _count: { _all: true } }),
    prisma.$queryRaw<{ date: Date; reported: number; resolved: number }[]>`
      SELECT d::date AS date,
             (SELECT count(*)::int FROM "Incident" WHERE "deletedAt" IS NULL AND "createdAt" >= d AND "createdAt" < d + interval '1 day') AS reported,
             (SELECT count(*)::int FROM "Incident" WHERE "deletedAt" IS NULL AND "resolvedAt" >= d AND "resolvedAt" < d + interval '1 day') AS resolved
      FROM generate_series(date_trunc('day', ${from}::timestamp), date_trunc('day', ${to}::timestamp), interval '1 day') AS d
      ORDER BY d
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
  const countOf = (rows: object[], key: string, value: string) =>
    (rows as ({ _count: { _all: number } } & Record<string, unknown>)[]).find((r) => r[key] === value)
      ?._count._all ?? 0;

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      total: t.total,
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
    // Every label is returned (zero-filled) so charts keep a stable shape.
    byCategory: (
      ["FIRE", "ROAD_ACCIDENT", "MEDICAL_EMERGENCY", "FLOOD", "BUILDING_COLLAPSE", "OTHER"] as IncidentCategory[]
    ).map((c) => ({ name: E.category.toLabel(c), count: countOf(byCategory, "category", c) })),
    byStatus: (["REPORTED", "PENDING", "IN_PROGRESS", "RESOLVED"] as IncidentStatus[]).map((s) => ({
      name: E.status.toLabel(s),
      value: countOf(byStatus, "status", s),
    })),
    bySeverity: (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[]).map((s) => ({
      name: E.severity.toLabel(s),
      count: countOf(bySeverity, "currentSeverity", s),
    })),
    daily: daily.map((d) => ({
      date: d.date.toISOString().slice(0, 10),
      reported: d.reported,
      resolved: d.resolved,
    })),
    recentActivity: recent.map((a) => ({
      ...toActivityDTO(a),
      incidentId: a.incident.id,
      reference: a.incident.trackingCode,
    })),
  };
}
