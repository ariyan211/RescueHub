import type {
  ActivityType,
  AssignmentMethod,
  Priority,
  ReleaseReason,
  TeamAvailability,
  TeamCategory,
  IncidentCategory,
  IncidentStatus,
  SafetyAnswer,
  Severity,
  Verification,
} from "@prisma/client";

/**
 * Two-way maps between database enum values and the display labels used by the
 * frontend contract (src/types/incident.ts). The API speaks labels so the React
 * app can consume responses without any translation layer.
 */
function bimap<D extends string, L extends string>(pairs: Record<D, L>) {
  const reverse = Object.fromEntries(Object.entries(pairs).map(([d, l]) => [l, d])) as Record<L, D>;
  return {
    toLabel: (value: D): L => pairs[value],
    toDb: (label: L): D => reverse[label],
    labels: Object.values(pairs) as [L, ...L[]],
  };
}

export const category = bimap({
  FIRE: "Fire",
  ROAD_ACCIDENT: "Road Accident",
  MEDICAL_EMERGENCY: "Medical Emergency",
  FLOOD: "Flood",
  BUILDING_COLLAPSE: "Building Collapse",
  OTHER: "Other Emergency",
} as const satisfies Record<IncidentCategory, string>);

export const severity = bimap({
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
} as const satisfies Record<Severity, string>);

export const status = bimap({
  REPORTED: "Reported",
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
} as const satisfies Record<IncidentStatus, string>);

export const verification = bimap({
  UNVERIFIED: "Unverified",
  UNDER_REVIEW: "Under Review",
  VERIFIED: "Verified",
} as const satisfies Record<Verification, string>);

export const safety = bimap({
  YES: "Yes",
  NO: "No",
  UNKNOWN: "Unknown",
} as const satisfies Record<SafetyAnswer, string>);

export const activityType = bimap({
  SUBMITTED: "submitted",
  SEVERITY_SUGGESTED: "severity_suggested",
  SEVERITY_CHANGED: "severity_changed",
  VERIFICATION_CHANGED: "verification_changed",
  STATUS_CHANGED: "status_changed",
  PRIORITY_CHANGED: "priority_changed",
  ASSIGNED: "assigned",
  TEAM_RELEASED: "team_released",
  NOTE: "note",
} as const satisfies Record<ActivityType, string>);

export const priority = bimap({
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
} as const satisfies Record<Priority, string>);

export const teamCategory = bimap({
  FIRE: "Fire",
  MEDICAL: "Medical",
  RESCUE: "Rescue",
  POLICE: "Police",
  DISASTER_RELIEF: "Disaster Relief",
} as const satisfies Record<TeamCategory, string>);

export const availability = bimap({
  AVAILABLE: "Available",
  BUSY: "Busy",
} as const satisfies Record<TeamAvailability, string>);

export const assignmentMethod = bimap({
  RECOMMENDED: "recommended",
  MANUAL: "manual",
} as const satisfies Record<AssignmentMethod, string>);

export const releaseReason = bimap({
  RESOLVED: "resolved",
  REASSIGNED: "reassigned",
  UNASSIGNED: "unassigned",
  INCIDENT_DELETED: "incident_deleted",
} as const satisfies Record<ReleaseReason, string>);

export type PriorityLabel = ReturnType<typeof priority.toLabel>;
export type TeamCategoryLabel = ReturnType<typeof teamCategory.toLabel>;
export type CategoryLabel = ReturnType<typeof category.toLabel>;
export type SeverityLabel = ReturnType<typeof severity.toLabel>;
export type StatusLabel = ReturnType<typeof status.toLabel>;
export type VerificationLabel = ReturnType<typeof verification.toLabel>;
export type SafetyLabel = ReturnType<typeof safety.toLabel>;
export type ActivityTypeLabel = ReturnType<typeof activityType.toLabel>;

export const SEVERITY_WEIGHT: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 4, CRITICAL: 8 };
