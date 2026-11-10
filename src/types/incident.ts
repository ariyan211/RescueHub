export const CATEGORIES = [
  "Fire",
  "Road Accident",
  "Medical Emergency",
  "Flood",
  "Building Collapse",
  "Other Emergency",
] as const;
export const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
/**
 * Lifecycle: Reported → (Pending review) → Assigned → In Progress → Resolved.
 * "Pending" is kept from Round 1: reviewed, awaiting a response team.
 */
export const STATUSES = ["Reported", "Pending", "Assigned", "In Progress", "Resolved"] as const;
export const VERIFICATIONS = ["Unverified", "Under Review", "Verified"] as const;
export const SAFETY_ANSWERS = ["Yes", "No", "Unknown"] as const;
/** Ordered most to least urgent. */
export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type IncidentStatus = (typeof STATUSES)[number];
export type Verification = (typeof VERIFICATIONS)[number];
export type SafetyAnswer = (typeof SAFETY_ANSWERS)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Activity {
  id: string;
  type:
    | "submitted"
    | "severity_suggested"
    | "severity_changed"
    | "verification_changed"
    | "status_changed"
    | "priority_changed"
    | "assigned"
    | "team_released"
    | "note";
  message: string;
  /** "Reporter", "System", or a staff display name when served by the API. */
  actor: "Reporter" | "System" | "Demo administrator" | (string & {});
  timestamp: string;
}

/** One weighted factor of the priority score, kept so the UI can explain the result. */
export interface PriorityFactor {
  key: "severity" | "people" | "waiting" | "category";
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface RouteInfo {
  /** "osrm" = road route from the routing service; "straight-line" = Haversine fallback. */
  source: "osrm" | "straight-line";
  distanceKm: number;
  /** Only present when a road route was available. */
  durationMin?: number;
}

/** A team ↔ incident assignment. Kept forever as history; `releasedAt` closes it. */
export interface Assignment {
  id: string;
  teamId: string;
  teamName: string;
  teamCategory: string;
  method: "recommended" | "manual";
  assignedAt: string;
  /** Haversine distance between team and incident at assignment time. */
  straightLineKm?: number;
  route?: RouteInfo;
  releasedAt?: string;
  releaseReason?: "resolved" | "reassigned" | "unassigned" | "incident_deleted";
}

export interface StatusChange {
  status: IncidentStatus;
  at: string;
  actor: Activity["actor"];
}

/** Round 1 record shape (what older saved data and the seed generator produce). */
export interface IncidentRecord {
  id: string;
  reference: string;
  title: string;
  description: string;
  category: Category;
  locationText: string;
  coordinates?: Coordinates;
  photos?: string[];
  peopleAffected: number;
  contactName?: string;
  contactDetails?: string;
  immediateThreat: SafetyAnswer;
  peopleTrapped: SafetyAnswer;
  ongoingHazard: SafetyAnswer;
  suggestedSeverity: Severity;
  currentSeverity: Severity;
  severityReason: string;
  requiresReview: boolean;
  status: IncidentStatus;
  verification: Verification;
  createdAt: string;
  updatedAt: string;
  activity: Activity[];
}

/** Full incident with Round 2 prioritization, assignment and lifecycle data. */
export interface Incident extends IncidentRecord {
  priority: Priority;
  /** 0–100 weighted score. */
  priorityScore: number;
  priorityFactors: PriorityFactor[];
  priorityUpdatedAt: string;
  /** Team currently responding, if any. Mirrors the open entry in `assignments`. */
  assignedTeamId?: string;
  assignments: Assignment[];
  statusHistory: StatusChange[];
  assignedAt?: string;
  inProgressAt?: string;
  resolvedAt?: string;
}

export type NewIncidentInput = Pick<
  Incident,
  | "title"
  | "description"
  | "category"
  | "locationText"
  | "peopleAffected"
  | "immediateThreat"
  | "peopleTrapped"
  | "ongoingHazard"
> &
  Partial<Pick<Incident, "coordinates" | "photos" | "contactName" | "contactDetails">>;
