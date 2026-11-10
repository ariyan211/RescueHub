import { Prisma, type ActivityType, type IncidentStatus, type Severity, type Verification } from "@prisma/client";
import type { IncidentDTO, Paginated, PublicIncidentDTO } from "../domain/contract.js";
import * as E from "../domain/enums.js";
import {
  incidentInclude,
  toActivityDTO,
  toIncidentDTO,
  toPublicActivityDTO,
  toPublicIncidentDTO,
  type IncidentWithRelations,
} from "../domain/mapper.js";
import { suggestSeverity } from "../domain/severity.js";
import { generateTrackingCode, normalizeTrackingCode } from "../domain/trackingCode.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { headObject } from "../lib/storage.js";
import { bus } from "../realtime/events.js";
import type { AdminListQuery, ReportIncidentInput } from "../schemas/incident.schemas.js";
import type { AuthUser } from "./auth.service.js";

type Tx = Prisma.TransactionClient;

const isUniqueViolation = (err: unknown, field: string) =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  err.code === "P2002" &&
  String((err.meta?.target as string[] | string | undefined) ?? "").includes(field);

async function publish(kind: "created" | "updated", incident: IncidentWithRelations) {
  const dto = await toIncidentDTO(incident);
  const publicView = toPublicIncidentDTO(incident);
  if (kind === "created") bus.emit("incident:created", { incident: dto, publicView });
  else {
    const last = incident.activity.at(-1);
    bus.emit("incident:updated", {
      incident: dto,
      publicView,
      change: last ? toActivityDTO(last) : null,
      publicChange: last?.isPublic ? toPublicActivityDTO(last) : null,
    });
  }
  return dto;
}

// ---------------------------------------------------------------------------
// Public: report & track
// ---------------------------------------------------------------------------

/**
 * Creates an incident. Severity is computed server-side from the safety
 * answers; media keys must have been issued by our presign endpoint and
 * actually exist in the bucket. An Idempotency-Key makes retries from flaky
 * mobile connections safe (the original report is returned instead).
 */
export async function reportIncident(
  input: ReportIncidentInput,
  idempotencyKey?: string,
): Promise<IncidentDTO> {
  if (idempotencyKey) {
    const existing = await prisma.incident.findUnique({
      where: { clientRequestId: idempotencyKey },
      include: incidentInclude,
    });
    if (existing) return toIncidentDTO(existing);
  }

  const media = await Promise.all(
    input.mediaKeys.map(async (key) => {
      const head = await headObject(key);
      if (!head) throw badRequest(`Media "${key}" has not been uploaded`);
      const contentType = head.contentType ?? "application/octet-stream";
      return {
        storageKey: key,
        contentType,
        sizeBytes: head.sizeBytes,
        type: contentType.startsWith("video/") ? ("VIDEO" as const) : ("IMAGE" as const),
      };
    }),
  );

  const suggestion = suggestSeverity(input);
  const contactName = input.contactName || null;
  const contactDetails = input.contactDetails || null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const incident = await prisma.incident.create({
        data: {
          trackingCode: generateTrackingCode(),
          clientRequestId: idempotencyKey ?? null,
          title: input.title,
          description: input.description,
          category: input.category,
          locationText: input.locationText,
          latitude: input.coordinates?.latitude ?? null,
          longitude: input.coordinates?.longitude ?? null,
          peopleAffected: input.peopleAffected,
          isAnonymous: !contactName && !contactDetails,
          contactName,
          contactDetails,
          immediateThreat: input.immediateThreat,
          peopleTrapped: input.peopleTrapped,
          ongoingHazard: input.ongoingHazard,
          suggestedSeverity: suggestion.severity,
          currentSeverity: suggestion.severity,
          severityReason: suggestion.reason,
          media: { create: media },
          activity: {
            create: [
              { type: "SUBMITTED", actorType: "REPORTER", message: "Report submitted." },
              {
                type: "SEVERITY_SUGGESTED",
                actorType: "SYSTEM",
                message: `${E.severity.toLabel(suggestion.severity)} severity suggested. ${suggestion.reason}`,
                isPublic: false,
              },
            ],
          },
        },
        include: incidentInclude,
      });
      logger.info(
        { incidentId: incident.id, severity: incident.currentSeverity, category: incident.category },
        "incident reported",
      );
      return publish("created", incident);
    } catch (err) {
      if (isUniqueViolation(err, "trackingCode")) continue; // astronomically rare; retry
      if (idempotencyKey && isUniqueViolation(err, "clientRequestId")) {
        // Concurrent retry won the race; return the winner.
        const winner = await prisma.incident.findUniqueOrThrow({
          where: { clientRequestId: idempotencyKey },
          include: incidentInclude,
        });
        return toIncidentDTO(winner);
      }
      if (isUniqueViolation(err, "storageKey")) throw conflict("Media is already attached to another report");
      throw err;
    }
  }
  throw new Error("Could not allocate a unique tracking code");
}

export async function findByTrackingCode(code: string): Promise<PublicIncidentDTO> {
  const incident = await prisma.incident.findFirst({
    where: { trackingCode: normalizeTrackingCode(code), deletedAt: null },
    include: incidentInclude,
  });
  if (!incident) throw notFound("No report found with that reference");
  return toPublicIncidentDTO(incident);
}

export async function trackingCodeExists(code: string): Promise<string | null> {
  const normalized = normalizeTrackingCode(code);
  const row = await prisma.incident.findFirst({
    where: { trackingCode: normalized, deletedAt: null },
    select: { trackingCode: true },
  });
  return row?.trackingCode ?? null;
}

export async function publicSummary() {
  const [total, criticalOpen, inProgress, resolved] = await Promise.all([
    prisma.incident.count({ where: { deletedAt: null } }),
    prisma.incident.count({
      where: { deletedAt: null, currentSeverity: "CRITICAL", status: { not: "RESOLVED" } },
    }),
    prisma.incident.count({ where: { deletedAt: null, status: "IN_PROGRESS" } }),
    prisma.incident.count({ where: { deletedAt: null, status: "RESOLVED" } }),
  ]);
  return { total, criticalOpen, inProgress, resolved };
}

// ---------------------------------------------------------------------------
// Staff: query
// ---------------------------------------------------------------------------

export async function listIncidents(
  query: AdminListQuery,
  user: AuthUser,
): Promise<Paginated<IncidentDTO>> {
  const where: Prisma.IncidentWhereInput = {
    deletedAt: null,
    ...(query.status && { status: { in: query.status } }),
    ...(query.severity && { currentSeverity: { in: query.severity } }),
    ...(query.category && { category: { in: query.category } }),
    ...(query.verification && { verification: { in: query.verification } }),
    ...(query.assigneeId && {
      assigneeId:
        query.assigneeId === "me" ? user.id : query.assigneeId === "unassigned" ? null : query.assigneeId,
    }),
    ...((query.from || query.to) && {
      createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) },
    }),
    ...(query.q && {
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { locationText: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { trackingCode: { equals: normalizeTrackingCode(query.q) } },
      ],
    }),
  };

  const desc = query.sort.startsWith("-");
  const field = query.sort.replace("-", "") as "createdAt" | "updatedAt" | "severity";
  // Postgres sorts enums by declaration order (LOW..CRITICAL), so "-severity" = most severe first.
  const orderBy: Prisma.IncidentOrderByWithRelationInput[] =
    field === "severity"
      ? [{ currentSeverity: desc ? "desc" : "asc" }, { createdAt: "desc" }]
      : [{ [field]: desc ? "desc" : "asc" }];

  const [total, rows] = await prisma.$transaction([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: incidentInclude,
    }),
  ]);

  return {
    data: await Promise.all(rows.map(toIncidentDTO)),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getIncident(id: string): Promise<IncidentDTO> {
  const incident = await prisma.incident.findFirst({
    where: { id, deletedAt: null },
    include: incidentInclude,
  });
  if (!incident) throw notFound("Incident not found");
  return toIncidentDTO(incident);
}

// ---------------------------------------------------------------------------
// Staff: mutations
// ---------------------------------------------------------------------------

interface Change {
  data: Prisma.IncidentUpdateInput;
  entries: {
    type: ActivityType;
    message: string;
    isPublic: boolean;
    metadata?: Prisma.InputJsonValue;
  }[];
}

/**
 * Locks the row (SELECT ... FOR UPDATE) so concurrent dispatchers can't
 * interleave read-modify-write cycles, applies the change, appends audit
 * entries in the same transaction, then publishes the realtime event after
 * commit.
 */
async function mutate(
  id: string,
  actor: AuthUser,
  build: (current: Prisma.IncidentGetPayload<object>, tx: Tx) => Promise<Change | null> | Change | null,
): Promise<IncidentDTO> {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Incident" WHERE id = ${id}::uuid FOR UPDATE`;
    const current = await tx.incident.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw notFound("Incident not found");

    const change = await build(current, tx);
    if (!change) return null; // no-op

    await tx.incident.update({ where: { id }, data: change.data });
    await tx.incidentUpdate.createMany({
      data: change.entries.map((e) => ({
        incidentId: id,
        actorType: "STAFF" as const,
        actorId: actor.id,
        type: e.type,
        message: e.message,
        isPublic: e.isPublic,
        metadata: e.metadata,
      })),
    });
    return tx.incident.findUniqueOrThrow({ where: { id }, include: incidentInclude });
  });

  if (!updated) return getIncident(id);
  logger.info({ incidentId: id, actorId: actor.id }, "incident updated");
  return publish("updated", updated);
}

export function changeStatus(
  id: string,
  next: IncidentStatus,
  actor: AuthUser,
  note?: { text?: string; isPublic: boolean },
) {
  return mutate(id, actor, (current) => {
    if (current.status === next) return null;
    const now = new Date();
    const from = E.status.toLabel(current.status);
    const to = E.status.toLabel(next);
    const entries: Change["entries"] = [
      {
        type: "STATUS_CHANGED",
        message: `Status changed from ${from} to ${to}.`,
        isPublic: true,
        metadata: { from: current.status, to: next },
      },
    ];
    if (note?.text) entries.push({ type: "NOTE", message: note.text, isPublic: note.isPublic });
    return {
      data: {
        status: next,
        // First time a team is actively responding: drives response-time analytics.
        ...(next === "IN_PROGRESS" && !current.firstResponseAt && { firstResponseAt: now }),
        ...(next === "RESOLVED" ? { resolvedAt: now } : current.resolvedAt && { resolvedAt: null }),
      },
      entries,
    };
  });
}

export function changeVerification(id: string, next: Verification, actor: AuthUser) {
  return mutate(id, actor, (current) => {
    if (current.verification === next) return null;
    return {
      data: { verification: next, ...(next === "VERIFIED" && { requiresReview: false }) },
      entries: [
        {
          type: "VERIFICATION_CHANGED",
          message: `Verification changed from ${E.verification.toLabel(current.verification)} to ${E.verification.toLabel(next)}.`,
          isPublic: true,
          metadata: { from: current.verification, to: next },
        },
      ],
    };
  });
}

export function changeSeverity(id: string, next: Severity, reason: string, actor: AuthUser) {
  return mutate(id, actor, (current) => {
    if (current.currentSeverity === next) return null;
    return {
      data: { currentSeverity: next, requiresReview: false },
      entries: [
        {
          type: "SEVERITY_CHANGED",
          message: `Severity changed from ${E.severity.toLabel(current.currentSeverity)} to ${E.severity.toLabel(next)}. Reason: ${reason}`,
          isPublic: false,
          metadata: { from: current.currentSeverity, to: next, reason },
        },
      ],
    };
  });
}

export function addNote(id: string, message: string, isPublic: boolean, actor: AuthUser) {
  return mutate(id, actor, () => ({
    data: { updatedAt: new Date() },
    entries: [{ type: "NOTE", message, isPublic }],
  }));
}

export function assign(id: string, assigneeId: string | null, actor: AuthUser) {
  return mutate(id, actor, async (current, tx) => {
    if (current.assigneeId === assigneeId) return null;
    let message = "Incident unassigned.";
    if (assigneeId) {
      const assignee = await tx.user.findFirst({
        where: { id: assigneeId, active: true, role: { in: ["DISPATCHER", "RESPONDER", "ADMIN"] } },
      });
      if (!assignee) throw badRequest("Assignee must be an active staff member");
      message = `Assigned to ${assignee.name}.`;
    }
    return {
      data: { assignee: assigneeId ? { connect: { id: assigneeId } } : { disconnect: true } },
      entries: [
        {
          type: "ASSIGNED",
          message,
          isPublic: false,
          metadata: { from: current.assigneeId, to: assigneeId },
        },
      ],
    };
  });
}

/** Soft delete: the record and its audit trail are retained. */
export async function softDelete(id: string, actor: AuthUser) {
  const incident = await prisma.incident.findFirst({ where: { id, deletedAt: null } });
  if (!incident) throw notFound("Incident not found");
  await prisma.$transaction([
    prisma.incident.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.incidentUpdate.create({
      data: {
        incidentId: id,
        type: "NOTE",
        actorType: "STAFF",
        actorId: actor.id,
        isPublic: false,
        message: "Incident deleted.",
      },
    }),
  ]);
  logger.warn({ incidentId: id, actorId: actor.id }, "incident deleted");
  bus.emit("incident:deleted", { id, reference: incident.trackingCode });
}
