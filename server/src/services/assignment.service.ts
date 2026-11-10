/**
 * Location-based team assignment.
 *
 * Recommend: PostGIS KNN (<->) over the GiST index finds the nearest available
 * teams of a suitable category; OSRM then ranks the shortlist by road drive
 * time. If OSRM is down, the straight-line ranking is used and labelled.
 *
 * Assign: one transaction that locks the incident, then the teams (sorted),
 * re-checks availability, writes the assignment, flips the team to Busy and
 * the incident to Assigned. Partial unique indexes back this up in the
 * database, so two simultaneous assignments of one team cannot both commit.
 */
import { Prisma, type AssignmentMethod, type ResponseTeam } from "@prisma/client";
import type { TeamRecommendationDTO } from "../domain/contract.js";
import * as E from "../domain/enums.js";
import { incidentInclude, toIncidentDTO, toPublicActivityDTO, toPublicIncidentDTO, toActivityDTO, toTeamDTO } from "../domain/mapper.js";
import { haversineKm, isSuitable, SUITABLE_TEAMS } from "../domain/teams.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { getRoute, straightLine, type RouteResult } from "../lib/routing.js";
import { bus } from "../realtime/events.js";
import type { AuthUser } from "./auth.service.js";
import { publishTeams } from "./team.service.js";
import {
  assignmentConflict,
  lockIncident,
  lockTeams,
  refreshPriorityTx,
  releaseTeamTx,
  setStatusTx,
} from "./workflowTx.js";

const SHORTLIST = 4;

const routeDTO = (r: RouteResult) => ({
  source: r.source,
  distanceKm: r.distanceKm,
  ...(r.durationMin !== undefined && { durationMin: r.durationMin }),
  geometry: r.geometry,
  ...(r.fallbackReason && { fallbackReason: r.fallbackReason }),
});

export async function recommendTeams(incidentId: string): Promise<{
  basis: "road-duration" | "straight-line" | "none";
  reason?: string;
  recommendations: TeamRecommendationDTO[];
}> {
  const incident = await prisma.incident.findFirst({ where: { id: incidentId, deletedAt: null } });
  if (!incident) throw notFound("Incident not found");
  if (incident.status === "RESOLVED") return { basis: "none", reason: "Incident is resolved.", recommendations: [] };
  if (incident.latitude == null || incident.longitude == null)
    return { basis: "none", reason: "Incident has no coordinates; assign a team manually.", recommendations: [] };

  const categories = SUITABLE_TEAMS[incident.category];
  const rows = await prisma.$queryRaw<(ResponseTeam & { km: number })[]>`
    SELECT t.id, t.code, t.name, t.category, t.latitude, t.longitude, t.availability,
           t."contactName", t."contactPhone", t."contactEmail", t."deletedAt", t."createdAt", t."updatedAt",
           ST_Distance(t.location, i.location) / 1000 AS km
    FROM "ResponseTeam" t, "Incident" i
    WHERE i.id = ${incidentId}::uuid
      AND t."deletedAt" IS NULL
      AND t.availability = 'AVAILABLE'
      AND t.category::text IN (${Prisma.join(categories)})
      AND NOT EXISTS (SELECT 1 FROM "Incident" x WHERE x."assignedTeamId" = t.id)
    ORDER BY t.location <-> i.location
    LIMIT ${SHORTLIST}
  `;
  if (!rows.length)
    return {
      basis: "none",
      reason: `No available ${categories.map(E.teamCategory.toLabel).join(", ")} team.`,
      recommendations: [],
    };

  const to = { latitude: incident.latitude, longitude: incident.longitude };
  const routed = await Promise.all(
    rows.map(async (team) => ({ team, km: Number(team.km), route: await getRoute(team, to) })),
  );
  const byRoad = routed.filter((r) => r.route.source === "osrm");
  const ordered = byRoad.length
    ? [...byRoad.sort((a, b) => a.route.durationMin! - b.route.durationMin!), ...routed.filter((r) => r.route.source !== "osrm")]
    : routed;
  return {
    basis: byRoad.length ? "road-duration" : "straight-line",
    recommendations: ordered.map((r) => ({
      team: toTeamDTO({ ...r.team, activeIncident: null }),
      straightLineKm: r.km,
      route: routeDTO(r.route),
    })),
  };
}

export async function assignTeam(
  incidentId: string,
  teamId: string,
  options: { method: AssignmentMethod; overrideCategory?: boolean },
  actor: AuthUser,
) {
  // Route lookup happens before the transaction: never hold row locks across network calls.
  const pre = await prisma.incident.findFirst({ where: { id: incidentId, deletedAt: null } });
  const preTeam = await prisma.responseTeam.findFirst({ where: { id: teamId, deletedAt: null } });
  if (!pre) throw notFound("Incident not found");
  if (!preTeam) throw notFound("Response team not found");
  const to = pre.latitude != null && pre.longitude != null ? { latitude: pre.latitude, longitude: pre.longitude } : null;
  const route = to ? await getRoute(preTeam, to) : null;

  const now = new Date();
  let previousTeam: string | null = null;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const incident = await lockIncident(tx, incidentId);
      await lockTeams(tx, [teamId, ...(incident.assignedTeamId ? [incident.assignedTeamId] : [])]);
      const team = await tx.responseTeam.findFirst({
        where: { id: teamId, deletedAt: null },
        include: { activeIncident: { select: { id: true } } },
      });
      if (!team) throw notFound("Response team not found");

      if (incident.status === "RESOLVED") throw conflict("This incident is resolved. Reopen it before assigning a team.");
      if (incident.assignedTeamId === team.id) throw conflict(`${team.name} is already assigned to this incident.`);
      if (team.activeIncident || team.availability === "BUSY")
        throw conflict(
          team.activeIncident
            ? `${team.name} is busy on another incident and cannot be assigned.`
            : `${team.name} is marked busy and cannot be assigned.`,
        );
      if (!isSuitable(team.category, incident.category) && !options.overrideCategory)
        throw badRequest(
          `${team.name} (${E.teamCategory.toLabel(team.category)}) is not a standard responder for ${E.category.toLabel(incident.category)}. Set overrideCategory to assign anyway.`,
        );

      if (incident.assignedTeamId) {
        previousTeam = incident.assignedTeamId;
        await releaseTeamTx(tx, incident, "REASSIGNED", actor.id, now);
      }

      const km = to ? haversineKm(team, to) : null;
      // A route computed for a different team position is discarded.
      const r = route && (team.latitude !== preTeam.latitude || team.longitude !== preTeam.longitude) && to ? straightLine(team, to) : route;
      await tx.teamAssignment.create({
        data: {
          incidentId,
          teamId,
          method: options.method,
          assignedById: actor.id,
          assignedAt: now,
          straightLineKm: km,
          ...(r && {
            routeSource: r.source === "osrm" ? "OSRM" : "STRAIGHT_LINE",
            routeDistanceKm: r.distanceKm,
            routeDurationMin: r.durationMin ?? null,
          }),
        },
      });
      await tx.incident.update({ where: { id: incidentId }, data: { assignedTeamId: teamId, assignedAt: now } });
      await tx.responseTeam.update({ where: { id: teamId }, data: { availability: "BUSY" } });
      const distance = r
        ? r.source === "osrm"
          ? ` Road distance ${r.distanceKm.toFixed(1)} km, about ${Math.round(r.durationMin ?? 0)} min drive.`
          : ` Straight-line distance ${r.distanceKm.toFixed(1)} km (road route unavailable).`
        : "";
      await tx.incidentUpdate.create({
        data: {
          incidentId,
          type: "ASSIGNED",
          actorType: "STAFF",
          actorId: actor.id,
          isPublic: false,
          createdAt: now,
          message: `${team.name} (${E.teamCategory.toLabel(team.category)}) assigned ${options.method === "RECOMMENDED" ? "from the nearest-team recommendation" : "manually"}.${distance}`,
          metadata: { teamId, method: options.method, straightLineKm: km, route: r ? { source: r.source, distanceKm: r.distanceKm, durationMin: r.durationMin ?? null } : null },
        },
      });
      // Fresh assignment always restarts at Assigned (also from In Progress on reassignment).
      if (incident.status !== "ASSIGNED") await setStatusTx(tx, incident, "ASSIGNED", actor.id, now);
      await refreshPriorityTx(tx, incidentId, now);
      return tx.incident.findUniqueOrThrow({ where: { id: incidentId }, include: incidentInclude });
    });

    logger.info({ incidentId, teamId, actorId: actor.id, method: options.method }, "team assigned");
    void publishTeams([teamId, ...(previousTeam ? [previousTeam] : [])]);
    const dto = await toIncidentDTO(updated);
    const last = updated.activity.at(-1);
    bus.emit("incident:updated", {
      incident: dto,
      publicView: toPublicIncidentDTO(updated),
      change: last ? toActivityDTO(last) : null,
      publicChange: last?.isPublic ? toPublicActivityDTO(last) : null,
    });
    return dto;
  } catch (err) {
    return assignmentConflict(err);
  }
}

/** Removes the current team without resolving: incident → Pending, team → Available. */
export async function unassignTeam(incidentId: string, actor: AuthUser) {
  const current = await prisma.incident.findFirst({ where: { id: incidentId, deletedAt: null } });
  if (!current) throw notFound("Incident not found");
  if (!current.assignedTeamId) throw conflict("No team is assigned to this incident.");
  const { changeStatus } = await import("./incident.service.js");
  return changeStatus(incidentId, "PENDING", actor);
}

/** Road route for the active assignment (for the map); straight-line fallback is labelled. */
export async function activeRoute(incidentId: string) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, deletedAt: null },
    include: { assignedTeam: true },
  });
  if (!incident) throw notFound("Incident not found");
  if (!incident.assignedTeam || incident.latitude == null || incident.longitude == null) return null;
  const route = await getRoute(incident.assignedTeam, { latitude: incident.latitude, longitude: incident.longitude });
  return { teamId: incident.assignedTeam.id, ...routeDTO(route) };
}
