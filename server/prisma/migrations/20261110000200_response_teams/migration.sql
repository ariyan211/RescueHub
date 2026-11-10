-- Round 2: response teams, assignments, status history and automatic priority.
-- Generated with `prisma migrate diff`; hand-written guarantees are appended at the end.

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TeamCategory" AS ENUM ('FIRE', 'MEDICAL', 'RESCUE', 'POLICE', 'DISASTER_RELIEF');

-- CreateEnum
CREATE TYPE "TeamAvailability" AS ENUM ('AVAILABLE', 'BUSY');

-- CreateEnum
CREATE TYPE "AssignmentMethod" AS ENUM ('RECOMMENDED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReleaseReason" AS ENUM ('RESOLVED', 'REASSIGNED', 'UNASSIGNED', 'INCIDENT_DELETED');

-- CreateEnum
CREATE TYPE "RouteSource" AS ENUM ('OSRM', 'STRAIGHT_LINE');

-- AlterEnum
ALTER TYPE "IncidentStatus" ADD VALUE 'ASSIGNED' BEFORE 'IN_PROGRESS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'PRIORITY_CHANGED';
ALTER TYPE "ActivityType" ADD VALUE 'TEAM_RELEASED';

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedTeamId" UUID,
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "priorityFactors" JSONB,
ADD COLUMN     "priorityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priorityUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ResponseTeam" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "category" "TeamCategory" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326),
    "availability" "TeamAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "contactName" VARCHAR(120) NOT NULL,
    "contactPhone" VARCHAR(30) NOT NULL,
    "contactEmail" VARCHAR(200),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAssignment" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "method" "AssignmentMethod" NOT NULL,
    "assignedById" UUID,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "straightLineKm" DOUBLE PRECISION,
    "routeSource" "RouteSource",
    "routeDistanceKm" DOUBLE PRECISION,
    "routeDurationMin" DOUBLE PRECISION,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" "ReleaseReason",

    CONSTRAINT "TeamAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentStatusChange" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "fromStatus" "IncidentStatus",
    "toStatus" "IncidentStatus" NOT NULL,
    "actorId" UUID,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponseTeam_code_key" ON "ResponseTeam"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseTeam_name_key" ON "ResponseTeam"("name");

-- CreateIndex
CREATE INDEX "ResponseTeam_category_availability_idx" ON "ResponseTeam"("category", "availability");

-- CreateIndex
CREATE INDEX "ResponseTeam_location_idx" ON "ResponseTeam" USING GIST ("location");

-- CreateIndex
CREATE INDEX "TeamAssignment_incidentId_assignedAt_idx" ON "TeamAssignment"("incidentId", "assignedAt");

-- CreateIndex
CREATE INDEX "TeamAssignment_teamId_assignedAt_idx" ON "TeamAssignment"("teamId", "assignedAt");

-- CreateIndex
CREATE INDEX "IncidentStatusChange_incidentId_changedAt_idx" ON "IncidentStatusChange"("incidentId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_assignedTeamId_key" ON "Incident"("assignedTeamId");

-- CreateIndex
CREATE INDEX "Incident_priority_status_idx" ON "Incident"("priority", "status");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "ResponseTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAssignment" ADD CONSTRAINT "TeamAssignment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAssignment" ADD CONSTRAINT "TeamAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ResponseTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAssignment" ADD CONSTRAINT "TeamAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentStatusChange" ADD CONSTRAINT "IncidentStatusChange_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentStatusChange" ADD CONSTRAINT "IncidentStatusChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written guarantees (invisible to Prisma diffing, so they cause no drift)
-- ---------------------------------------------------------------------------

-- No duplicate assignments: at most ONE open assignment per team and per incident.
-- Even if two dispatchers click "assign" at the same instant, the second insert fails.
CREATE UNIQUE INDEX "TeamAssignment_one_open_per_team"
  ON "TeamAssignment" ("teamId") WHERE "releasedAt" IS NULL;
CREATE UNIQUE INDEX "TeamAssignment_one_open_per_incident"
  ON "TeamAssignment" ("incidentId") WHERE "releasedAt" IS NULL;

-- A released assignment must say why; an open one must not.
ALTER TABLE "TeamAssignment"
  ADD CONSTRAINT "TeamAssignment_release_consistent"
  CHECK (("releasedAt" IS NULL) = ("releaseReason" IS NULL)),
  ADD CONSTRAINT "TeamAssignment_distances_positive"
  CHECK ("straightLineKm" IS NULL OR "straightLineKm" >= 0);

ALTER TABLE "ResponseTeam"
  ADD CONSTRAINT "ResponseTeam_latitude_range"  CHECK ("latitude"  BETWEEN -90  AND 90),
  ADD CONSTRAINT "ResponseTeam_longitude_range" CHECK ("longitude" BETWEEN -180 AND 180);

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_priorityScore_range" CHECK ("priorityScore" BETWEEN 0 AND 100);

-- Keep ResponseTeam.location in sync with latitude/longitude (same pattern as Incident).
CREATE OR REPLACE FUNCTION team_sync_location() RETURNS trigger AS $$
BEGIN
  NEW."location" := ST_SetSRID(ST_MakePoint(NEW."longitude", NEW."latitude"), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_sync_location
  BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "ResponseTeam"
  FOR EACH ROW EXECUTE FUNCTION team_sync_location();

-- Hot path for nearest-team search: available, not deleted.
CREATE INDEX "ResponseTeam_available_location_idx" ON "ResponseTeam" USING GIST ("location")
  WHERE "availability" = 'AVAILABLE' AND "deletedAt" IS NULL;

-- Backfill the status timeline for incidents that existed before this migration.
-- Priority is computed by the API on start-up for rows where priorityUpdatedAt IS NULL.
INSERT INTO "IncidentStatusChange" ("id", "incidentId", "fromStatus", "toStatus", "changedAt")
SELECT gen_random_uuid(), "id", NULL, 'REPORTED', "createdAt" FROM "Incident";
INSERT INTO "IncidentStatusChange" ("id", "incidentId", "fromStatus", "toStatus", "changedAt")
SELECT gen_random_uuid(), "id", 'REPORTED', "status", "updatedAt" FROM "Incident" WHERE "status" <> 'REPORTED';
