-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CITIZEN', 'DISPATCHER', 'RESPONDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('FIRE', 'ROAD_ACCIDENT', 'MEDICAL_EMERGENCY', 'FLOOD', 'BUILDING_COLLAPSE', 'OTHER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'PENDING', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "Verification" AS ENUM ('UNVERIFIED', 'UNDER_REVIEW', 'VERIFIED');

-- CreateEnum
CREATE TYPE "SafetyAnswer" AS ENUM ('YES', 'NO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('SUBMITTED', 'SEVERITY_SUGGESTED', 'SEVERITY_CHANGED', 'VERIFICATION_CHANGED', 'STATUS_CHANGED', 'ASSIGNED', 'NOTE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('REPORTER', 'SYSTEM', 'STAFF');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "clientRequestId" TEXT,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "locationText" VARCHAR(300) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location" geography(Point, 4326),
    "peopleAffected" INTEGER NOT NULL DEFAULT 0,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "contactName" VARCHAR(120),
    "contactDetails" VARCHAR(200),
    "immediateThreat" "SafetyAnswer" NOT NULL,
    "peopleTrapped" "SafetyAnswer" NOT NULL,
    "ongoingHazard" "SafetyAnswer" NOT NULL,
    "suggestedSeverity" "Severity" NOT NULL,
    "currentSeverity" "Severity" NOT NULL,
    "severityReason" TEXT NOT NULL,
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "verification" "Verification" NOT NULL DEFAULT 'UNVERIFIED',
    "assigneeId" UUID,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentMedia" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentUpdate" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_trackingCode_key" ON "Incident"("trackingCode");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_clientRequestId_key" ON "Incident"("clientRequestId");

-- CreateIndex
CREATE INDEX "Incident_status_currentSeverity_idx" ON "Incident"("status", "currentSeverity");

-- CreateIndex
CREATE INDEX "Incident_category_idx" ON "Incident"("category");

-- CreateIndex
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Incident_assigneeId_idx" ON "Incident"("assigneeId");

-- CreateIndex
CREATE INDEX "Incident_location_idx" ON "Incident" USING GIST ("location");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentMedia_storageKey_key" ON "IncidentMedia"("storageKey");

-- CreateIndex
CREATE INDEX "IncidentMedia_incidentId_idx" ON "IncidentMedia"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentUpdate_incidentId_createdAt_idx" ON "IncidentUpdate"("incidentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentMedia" ADD CONSTRAINT "IncidentMedia_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

