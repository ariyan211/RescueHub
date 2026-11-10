/**
 * Seeds the first admin account and (optionally) the fictional demo data.
 * Demo incidents, response teams and assignments come from the frontend's own
 * builders (src/data/*.ts, src/domain/workflow.ts), so the database starts in
 * exactly the state the browser demo shows. Safe to re-run.
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type ActorType, type IncidentStatus } from "@prisma/client";
import { createSeedIncidents } from "../../src/data/seedIncidents";
import { attachSeedOperations, createSeedTeams } from "../../src/data/seedTeams";
import { normalizeIncident } from "../../src/domain/workflow";
import * as E from "../src/domain/enums";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@responsehub.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("SEED_ADMIN_PASSWORD must be set (12+ characters)");

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: process.env.SEED_ADMIN_NAME ?? "Response Hub Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  console.log(`Admin user: ${admin.email}`);

  if (process.env.SEED_DEMO_INCIDENTS !== "true") return;

  const now = new Date();
  const demo = attachSeedOperations(
    createSeedIncidents().map((r) => normalizeIncident(r, now)),
    createSeedTeams(now),
    now,
  );

  // ---- Response teams (keyed by TEAM-### code) ----
  const teamIds = new Map<string, string>();
  for (const t of demo.teams) {
    const row = await prisma.responseTeam.upsert({
      where: { code: t.id },
      update: {},
      create: {
        code: t.id,
        name: t.name,
        category: E.teamCategory.toDb(t.category),
        latitude: t.latitude,
        longitude: t.longitude,
        availability: "AVAILABLE",
        contactName: t.contactName,
        contactPhone: t.contactPhone,
        contactEmail: t.contactEmail ?? null,
        createdAt: t.createdAt,
      },
    });
    teamIds.set(t.id, row.id);
  }
  console.log(`Response teams: ${teamIds.size}`);

  // ---- Incidents with priority, lifecycle, assignments ----
  let created = 0;
  for (const d of demo.incidents) {
    if (await prisma.incident.findUnique({ where: { trackingCode: d.reference } })) continue;
    const history = d.statusHistory.map((h, i) => ({
      fromStatus: i === 0 ? null : E.status.toDb(d.statusHistory[i - 1]!.status),
      toStatus: E.status.toDb(h.status) as IncidentStatus,
      actorId: h.actor === "Reporter" || h.actor === "System" ? null : admin.id,
      changedAt: h.at,
    }));
    const incident = await prisma.incident.create({
      data: {
        trackingCode: d.reference,
        title: d.title,
        description: d.description,
        category: E.category.toDb(d.category),
        locationText: d.locationText,
        latitude: d.coordinates?.latitude ?? null,
        longitude: d.coordinates?.longitude ?? null,
        peopleAffected: d.peopleAffected,
        immediateThreat: E.safety.toDb(d.immediateThreat),
        peopleTrapped: E.safety.toDb(d.peopleTrapped),
        ongoingHazard: E.safety.toDb(d.ongoingHazard),
        suggestedSeverity: E.severity.toDb(d.suggestedSeverity),
        currentSeverity: E.severity.toDb(d.currentSeverity),
        severityReason: d.severityReason,
        requiresReview: d.requiresReview,
        status: E.status.toDb(d.status),
        verification: E.verification.toDb(d.verification),
        priority: E.priority.toDb(d.priority),
        priorityScore: d.priorityScore,
        priorityFactors: d.priorityFactors as never,
        priorityUpdatedAt: now,
        assignedAt: d.assignedAt ?? null,
        firstResponseAt: d.inProgressAt ?? null,
        resolvedAt: d.resolvedAt ?? null,
        createdAt: d.createdAt,
        statusChanges: { create: history },
        activity: {
          create: d.activity.map((a) => {
            const actorType: ActorType =
              a.actor === "Reporter" ? "REPORTER" : a.actor === "System" ? "SYSTEM" : "STAFF";
            return {
              type: E.activityType.toDb(a.type as never),
              message: a.message,
              actorType,
              actorId: actorType === "STAFF" ? admin.id : null,
              isPublic: !["severity_suggested", "priority_changed", "assigned", "team_released", "note"].includes(a.type),
              createdAt: a.timestamp,
            };
          }),
        },
        assignments: {
          create: d.assignments.map((a) => ({
            teamId: teamIds.get(a.teamId)!,
            method: E.assignmentMethod.toDb(a.method),
            assignedById: admin.id,
            assignedAt: a.assignedAt,
            straightLineKm: a.straightLineKm ?? null,
            routeSource: a.route ? (a.route.source === "osrm" ? "OSRM" : "STRAIGHT_LINE") : null,
            routeDistanceKm: a.route?.distanceKm ?? null,
            routeDurationMin: a.route?.durationMin ?? null,
            releasedAt: a.releasedAt ?? null,
            releaseReason: a.releaseReason ? E.releaseReason.toDb(a.releaseReason) : null,
          })),
        },
      },
    });
    if (d.assignedTeamId) {
      const teamId = teamIds.get(d.assignedTeamId)!;
      await prisma.$transaction([
        prisma.incident.update({ where: { id: incident.id }, data: { assignedTeamId: teamId } }),
        prisma.responseTeam.update({ where: { id: teamId }, data: { availability: "BUSY" } }),
      ]);
    }
    created++;
  }
  console.log(`Demo incidents created: ${created}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
