import type {
  Incident,
  IncidentMedia,
  IncidentUpdate,
  Prisma,
  ResponseTeam,
  TeamAssignment,
  User,
} from "@prisma/client";
import { mediaUrl } from "../lib/storage.js";
import type {
  ActivityDTO,
  AssignmentDTO,
  PriorityFactorDTO,
  TeamDTO,
  IncidentDTO,
  MediaDTO,
  PublicIncidentDTO,
  StaffRole,
  StaffSummary,
} from "./contract.js";
import * as E from "./enums.js";

const actorSelect = { select: { id: true, name: true, role: true } } as const;

export const incidentInclude = {
  media: { orderBy: { uploadedAt: "asc" } },
  activity: { orderBy: { createdAt: "asc" }, include: { actor: actorSelect } },
  assignee: actorSelect,
  assignedTeam: true,
  assignments: { orderBy: { assignedAt: "asc" }, include: { team: { select: { name: true, category: true } } } },
  statusChanges: { orderBy: { changedAt: "asc" }, include: { actor: { select: { name: true } } } },
} satisfies Prisma.IncidentInclude;

export function toTeamDTO(t: ResponseTeam & { activeIncident?: { id: string } | null }): TeamDTO {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    category: E.teamCategory.toLabel(t.category),
    latitude: t.latitude,
    longitude: t.longitude,
    availability: E.availability.toLabel(t.availability),
    ...(t.activeIncident && { assignedIncidentId: t.activeIncident.id }),
    contactName: t.contactName,
    contactPhone: t.contactPhone,
    ...(t.contactEmail && { contactEmail: t.contactEmail }),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function toAssignmentDTO(
  a: TeamAssignment & { team: Pick<ResponseTeam, "name" | "category"> },
): AssignmentDTO {
  return {
    id: a.id,
    teamId: a.teamId,
    teamName: a.team.name,
    teamCategory: E.teamCategory.toLabel(a.team.category),
    method: E.assignmentMethod.toLabel(a.method),
    assignedAt: a.assignedAt.toISOString(),
    ...(a.straightLineKm != null && { straightLineKm: a.straightLineKm }),
    ...(a.routeSource &&
      a.routeDistanceKm != null && {
        route: {
          source: a.routeSource === "OSRM" ? ("osrm" as const) : ("straight-line" as const),
          distanceKm: a.routeDistanceKm,
          ...(a.routeDurationMin != null && { durationMin: a.routeDurationMin }),
        },
      }),
    ...(a.releasedAt && { releasedAt: a.releasedAt.toISOString() }),
    ...(a.releaseReason && { releaseReason: E.releaseReason.toLabel(a.releaseReason) }),
  };
}

export type IncidentWithRelations = Prisma.IncidentGetPayload<{ include: typeof incidentInclude }>;
export type ActivityWithActor = IncidentUpdate & {
  actor: Pick<User, "id" | "name" | "role"> | null;
};

const staffRole = (role: User["role"] | undefined): StaffRole | undefined =>
  role && role !== "CITIZEN" ? role : undefined;

export function toActivityDTO(a: ActivityWithActor): ActivityDTO {
  const actor =
    a.actorType === "REPORTER"
      ? "Reporter"
      : a.actorType === "SYSTEM"
        ? "System"
        : (a.actor?.name ?? "Staff");
  const role = staffRole(a.actor?.role);
  return {
    id: a.id,
    type: E.activityType.toLabel(a.type),
    message: a.message,
    actor,
    ...(role && { actorRole: role }),
    isPublic: a.isPublic,
    timestamp: a.createdAt.toISOString(),
  };
}

function coordinates(i: Pick<Incident, "latitude" | "longitude">) {
  return i.latitude != null && i.longitude != null
    ? { coordinates: { latitude: i.latitude, longitude: i.longitude } }
    : {};
}

async function toMediaDTO(m: IncidentMedia): Promise<MediaDTO> {
  return {
    id: m.id,
    url: await mediaUrl(m.storageKey),
    type: m.type === "VIDEO" ? "video" : "image",
    contentType: m.contentType,
    uploadedAt: m.uploadedAt.toISOString(),
  };
}

function toStaffSummary(u: Pick<User, "id" | "name" | "role"> | null): StaffSummary | null {
  const role = staffRole(u?.role);
  return u && role ? { id: u.id, name: u.name, role } : null;
}

export async function toIncidentDTO(i: IncidentWithRelations): Promise<IncidentDTO> {
  const media = await Promise.all(i.media.map(toMediaDTO));
  const photos = media.filter((m) => m.type === "image").map((m) => m.url);
  return {
    id: i.id,
    reference: i.trackingCode,
    title: i.title,
    description: i.description,
    category: E.category.toLabel(i.category),
    locationText: i.locationText,
    ...coordinates(i),
    ...(photos.length > 0 && { photos }),
    media,
    peopleAffected: i.peopleAffected,
    isAnonymous: i.isAnonymous,
    ...(i.contactName && { contactName: i.contactName }),
    ...(i.contactDetails && { contactDetails: i.contactDetails }),
    immediateThreat: E.safety.toLabel(i.immediateThreat),
    peopleTrapped: E.safety.toLabel(i.peopleTrapped),
    ongoingHazard: E.safety.toLabel(i.ongoingHazard),
    suggestedSeverity: E.severity.toLabel(i.suggestedSeverity),
    currentSeverity: E.severity.toLabel(i.currentSeverity),
    severityReason: i.severityReason,
    requiresReview: i.requiresReview,
    status: E.status.toLabel(i.status),
    verification: E.verification.toLabel(i.verification),
    assignee: toStaffSummary(i.assignee),
    firstResponseAt: i.firstResponseAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    activity: i.activity.map(toActivityDTO),
    priority: E.priority.toLabel(i.priority),
    priorityScore: i.priorityScore,
    priorityFactors: (i.priorityFactors as PriorityFactorDTO[] | null) ?? [],
    priorityUpdatedAt: (i.priorityUpdatedAt ?? i.createdAt).toISOString(),
    ...(i.assignedTeamId && { assignedTeamId: i.assignedTeamId }),
    assignedTeam: i.assignedTeam ? toTeamDTO({ ...i.assignedTeam, activeIncident: { id: i.id } }) : null,
    assignments: i.assignments.map(toAssignmentDTO),
    statusHistory: i.statusChanges.map((s) => ({
      status: E.status.toLabel(s.toStatus),
      at: s.changedAt.toISOString(),
      actor: s.actor?.name ?? (s.toStatus === "REPORTED" ? "Reporter" : "System"),
    })),
    ...(i.assignedAt && { assignedAt: i.assignedAt.toISOString() }),
    ...(i.firstResponseAt && { inProgressAt: i.firstResponseAt.toISOString() }),
    ...(i.resolvedAt && { resolvedAt: i.resolvedAt.toISOString() }),
  };
}

export function toPublicActivityDTO(a: ActivityWithActor): ActivityDTO {
  const dto = toActivityDTO(a);
  // Individual staff names are not disclosed to the public.
  if (a.actorType !== "STAFF") return dto;
  const { actorRole: _role, ...rest } = dto;
  return { ...rest, actor: "Response team" };
}

export function toPublicIncidentDTO(i: IncidentWithRelations): PublicIncidentDTO {
  return {
    reference: i.trackingCode,
    title: i.title,
    category: E.category.toLabel(i.category),
    locationText: i.locationText,
    ...coordinates(i),
    currentSeverity: E.severity.toLabel(i.currentSeverity),
    status: E.status.toLabel(i.status),
    verification: E.verification.toLabel(i.verification),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    ...(i.assignedAt && { assignedAt: i.assignedAt.toISOString() }),
    ...(i.firstResponseAt && { inProgressAt: i.firstResponseAt.toISOString() }),
    ...(i.resolvedAt && { resolvedAt: i.resolvedAt.toISOString() }),
    hasResponseTeam: !!i.assignedTeamId,
    activity: i.activity.filter((a) => a.isPublic).map(toPublicActivityDTO),
  };
}
