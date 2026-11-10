/**
 * Seeds the first admin account and (optionally) the fictional demo incidents.
 * Demo incidents come straight from the frontend's src/data/seedIncidents.ts,
 * so the API and the localStorage demo show identical data. Safe to re-run.
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type ActorType } from "@prisma/client";
import { createSeedIncidents } from "../../src/data/seedIncidents";
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

  let created = 0;
  for (const demo of createSeedIncidents()) {
    if (await prisma.incident.findUnique({ where: { trackingCode: demo.reference } })) continue;
    const status = E.status.toDb(demo.status);
    const statusAt = demo.activity.find((a) => a.type === "status_changed")?.timestamp;
    await prisma.incident.create({
      data: {
        trackingCode: demo.reference,
        title: demo.title,
        description: demo.description,
        category: E.category.toDb(demo.category),
        locationText: demo.locationText,
        latitude: demo.coordinates?.latitude ?? null,
        longitude: demo.coordinates?.longitude ?? null,
        peopleAffected: demo.peopleAffected,
        immediateThreat: E.safety.toDb(demo.immediateThreat),
        peopleTrapped: E.safety.toDb(demo.peopleTrapped),
        ongoingHazard: E.safety.toDb(demo.ongoingHazard),
        suggestedSeverity: E.severity.toDb(demo.suggestedSeverity),
        currentSeverity: E.severity.toDb(demo.currentSeverity),
        severityReason: demo.severityReason,
        requiresReview: demo.requiresReview,
        status,
        verification: E.verification.toDb(demo.verification),
        firstResponseAt: status === "IN_PROGRESS" || status === "RESOLVED" ? (statusAt ?? null) : null,
        resolvedAt: status === "RESOLVED" ? (statusAt ?? null) : null,
        createdAt: demo.createdAt,
        activity: {
          create: demo.activity.map((a) => {
            const actorType: ActorType =
              a.actor === "Reporter" ? "REPORTER" : a.actor === "System" ? "SYSTEM" : "STAFF";
            return {
              type: E.activityType.toDb(a.type),
              message: a.message,
              actorType,
              actorId: actorType === "STAFF" ? admin.id : null,
              isPublic: a.type !== "severity_suggested",
              createdAt: a.timestamp,
            };
          }),
        },
      },
    });
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
