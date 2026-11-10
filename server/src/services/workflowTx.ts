/**
 * Transaction-level building blocks shared by the incident and assignment
 * services. Every function expects to run inside prisma.$transaction and to
 * be called with rows already locked (SELECT ... FOR UPDATE).
 *
 * Lock order (prevents deadlocks): incident row first, then team rows sorted by id.
 */
import { Prisma, type Incident, type IncidentStatus, type ReleaseReason } from "@prisma/client";
import * as E from "../domain/enums.js";
import { calculatePriority } from "../domain/priority.js";
import { conflict, notFound } from "../lib/errors.js";

export type Tx = Prisma.TransactionClient;

export async function lockIncident(tx: Tx, id: string): Promise<Incident> {
  await tx.$queryRaw`SELECT id FROM "Incident" WHERE id = ${id}::uuid FOR UPDATE`;
  const incident = await tx.incident.findFirst({ where: { id, deletedAt: null } });
  if (!incident) throw notFound("Incident not found");
  return incident;
}

export async function lockTeams(tx: Tx, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  if (!unique.length) return;
  await tx.$queryRaw`SELECT id FROM "ResponseTeam" WHERE id IN (${Prisma.join(unique.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
}

/** Closes the open assignment, frees the team and logs it. Returns the release time. */
export async function releaseTeamTx(
  tx: Tx,
  incident: Pick<Incident, "id" | "assignedTeamId">,
  reason: ReleaseReason,
  actorId: string | null,
  now: Date,
) {
  if (!incident.assignedTeamId) return;
  const team = await tx.responseTeam.update({
    where: { id: incident.assignedTeamId },
    data: { availability: "AVAILABLE" },
  });
  await tx.teamAssignment.updateMany({
    where: { incidentId: incident.id, releasedAt: null },
    data: { releasedAt: now, releaseReason: reason },
  });
  await tx.incident.update({ where: { id: incident.id }, data: { assignedTeamId: null } });
  const why = { RESOLVED: "incident resolved", REASSIGNED: "another team was assigned", UNASSIGNED: "unassigned by staff", INCIDENT_DELETED: "incident deleted" }[reason];
  await tx.incidentUpdate.create({
    data: {
      incidentId: incident.id,
      type: "TEAM_RELEASED",
      actorType: actorId ? "STAFF" : "SYSTEM",
      actorId,
      isPublic: false,
      message: `${team.name} released and available again (${why}).`,
      metadata: { teamId: team.id, reason },
      createdAt: now,
    },
  });
  return team;
}

/** Sets a new status with its timeline row, activity entry and lifecycle timestamp. */
export async function setStatusTx(
  tx: Tx,
  incident: Pick<Incident, "id" | "status" | "firstResponseAt">,
  next: IncidentStatus,
  actorId: string | null,
  now: Date,
) {
  if (incident.status === next) return;
  await tx.incident.update({
    where: { id: incident.id },
    data: {
      status: next,
      ...(next === "ASSIGNED" && { assignedAt: now }),
      ...(next === "IN_PROGRESS" && !incident.firstResponseAt && { firstResponseAt: now }),
      ...(next === "RESOLVED" ? { resolvedAt: now } : { resolvedAt: null }),
    },
  });
  await tx.incidentStatusChange.create({
    data: { incidentId: incident.id, fromStatus: incident.status, toStatus: next, actorId, changedAt: now },
  });
  await tx.incidentUpdate.create({
    data: {
      incidentId: incident.id,
      type: "STATUS_CHANGED",
      actorType: actorId ? "STAFF" : "SYSTEM",
      actorId,
      isPublic: true,
      message: `Status changed from ${E.status.toLabel(incident.status)} to ${E.status.toLabel(next)}.`,
      metadata: { from: incident.status, to: next },
      createdAt: now,
    },
  });
}

/** Priority columns for a row, computed with the shared weighted model. */
export function priorityColumns(
  i: Pick<Incident, "currentSeverity" | "peopleAffected" | "category" | "createdAt" | "status" | "resolvedAt">,
  now: Date,
) {
  const result = calculatePriority(
    {
      currentSeverity: E.severity.toLabel(i.currentSeverity),
      peopleAffected: i.peopleAffected,
      category: E.category.toLabel(i.category),
      createdAt: i.createdAt.toISOString(),
      status: E.status.toLabel(i.status),
      ...(i.resolvedAt && { resolvedAt: i.resolvedAt.toISOString() }),
    },
    now,
  );
  return {
    priority: E.priority.toDb(result.priority),
    priorityScore: result.score,
    priorityFactors: result.factors as unknown as Prisma.InputJsonValue,
    priorityUpdatedAt: now,
    summary: result.summary,
  };
}

/** Recomputes priority for an incident inside the transaction; logs level changes. */
export async function refreshPriorityTx(tx: Tx, id: string, now: Date, reason?: string) {
  const row = await tx.incident.findUniqueOrThrow({ where: { id } });
  const { summary: _s, ...cols } = priorityColumns(row, now);
  if (row.priorityScore === cols.priorityScore && row.priority === cols.priority && row.priorityUpdatedAt) return;
  await tx.incident.update({ where: { id }, data: cols });
  if (row.priorityUpdatedAt && row.priority !== cols.priority)
    await tx.incidentUpdate.create({
      data: {
        incidentId: id,
        type: "PRIORITY_CHANGED",
        actorType: "SYSTEM",
        isPublic: false,
        message: `Priority changed from ${E.priority.toLabel(row.priority)} to ${E.priority.toLabel(cols.priority)} (score ${cols.priorityScore}/100)${reason ? `: ${reason}` : ""}.`,
        metadata: { from: row.priority, to: cols.priority, score: cols.priorityScore },
        createdAt: now,
      },
    });
}

export const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** Maps the database's duplicate-assignment guards to a friendly 409. */
export function assignmentConflict(err: unknown): never {
  if (isUniqueViolation(err))
    throw conflict("That team was just assigned elsewhere (or this incident already has a team). Refresh and try again.");
  throw err;
}
