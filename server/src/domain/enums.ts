import type {
  ActivityType,
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
  ASSIGNED: "assigned",
  NOTE: "note",
} as const satisfies Record<ActivityType, string>);

export type CategoryLabel = ReturnType<typeof category.toLabel>;
export type SeverityLabel = ReturnType<typeof severity.toLabel>;
export type StatusLabel = ReturnType<typeof status.toLabel>;
export type VerificationLabel = ReturnType<typeof verification.toLabel>;
export type SafetyLabel = ReturnType<typeof safety.toLabel>;
export type ActivityTypeLabel = ReturnType<typeof activityType.toLabel>;

export const SEVERITY_WEIGHT: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 4, CRITICAL: 8 };
