/**
 * Wire contract shared with the React app. These shapes mirror
 * src/types/incident.ts in the frontend (same field names, same display-label
 * enums), plus a few additive fields the backend introduces.
 * The frontend copy lives in src/types/api.ts.
 */
import type {
  ActivityTypeLabel,
  CategoryLabel,
  PriorityLabel,
  TeamCategoryLabel,
  SafetyLabel,
  SeverityLabel,
  StatusLabel,
  VerificationLabel,
} from "./enums.js";

export type StaffRole = "DISPATCHER" | "RESPONDER" | "ADMIN";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ActivityDTO {
  id: string;
  type: ActivityTypeLabel;
  message: string;
  /** "Reporter", "System", or the staff member's display name ("Response team" on public views). */
  actor: string;
  actorRole?: StaffRole;
  isPublic: boolean;
  timestamp: string;
}

export interface MediaDTO {
  id: string;
  url: string;
  type: "image" | "video";
  contentType: string;
  uploadedAt: string;
}

export interface StaffSummary {
  id: string;
  name: string;
  role: StaffRole;
}

/** Full incident, staff only. Superset of the frontend `Incident` type. */
export interface IncidentDTO {
  id: string;
  reference: string;
  title: string;
  description: string;
  category: CategoryLabel;
  locationText: string;
  coordinates?: Coordinates;
  photos?: string[];
  media: MediaDTO[];
  peopleAffected: number;
  isAnonymous: boolean;
  contactName?: string;
  contactDetails?: string;
  immediateThreat: SafetyLabel;
  peopleTrapped: SafetyLabel;
  ongoingHazard: SafetyLabel;
  suggestedSeverity: SeverityLabel;
  currentSeverity: SeverityLabel;
  severityReason: string;
  requiresReview: boolean;
  status: StatusLabel;
  verification: VerificationLabel;
  assignee: StaffSummary | null;
  firstResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
  activity: ActivityDTO[];

  // ---- Round 2 (same field names as the frontend Incident type) ----
  priority: PriorityLabel;
  priorityScore: number;
  priorityFactors: PriorityFactorDTO[];
  priorityUpdatedAt: string;
  assignedTeamId?: string;
  assignedTeam: TeamDTO | null;
  assignments: AssignmentDTO[];
  statusHistory: StatusChangeDTO[];
  assignedAt?: string;
  inProgressAt?: string;
  resolvedAt?: string;
}

export interface PriorityFactorDTO {
  key: "severity" | "people" | "waiting" | "category";
  label: string;
  points: number;
  max: number;
  detail: string;
}

/** Mirrors ResponseTeam in src/types/team.ts; `id` is the UUID, `code` the TEAM-### label. */
export interface TeamDTO {
  id: string;
  code: string;
  name: string;
  category: TeamCategoryLabel;
  latitude: number;
  longitude: number;
  availability: "Available" | "Busy";
  assignedIncidentId?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RouteInfoDTO {
  source: "osrm" | "straight-line";
  distanceKm: number;
  durationMin?: number;
}

export interface AssignmentDTO {
  id: string;
  teamId: string;
  teamName: string;
  teamCategory: TeamCategoryLabel;
  method: "recommended" | "manual";
  assignedAt: string;
  straightLineKm?: number;
  route?: RouteInfoDTO;
  releasedAt?: string;
  releaseReason?: "resolved" | "reassigned" | "unassigned" | "incident_deleted";
}

export interface StatusChangeDTO {
  status: StatusLabel;
  at: string;
  actor: string;
}

export interface TeamRecommendationDTO {
  team: TeamDTO;
  straightLineKm: number;
  route: RouteInfoDTO & { geometry: [number, number][]; fallbackReason?: string };
}

/** What a citizen sees on the tracking page: no contact details, media or private notes. */
export interface PublicIncidentDTO {
  /** Lifecycle timestamps (Reported → Assigned → In Progress → Resolved). No team identity is disclosed. */
  assignedAt?: string;
  inProgressAt?: string;
  resolvedAt?: string;
  hasResponseTeam: boolean;
  reference: string;
  title: string;
  category: CategoryLabel;
  locationText: string;
  coordinates?: Coordinates;
  currentSeverity: SeverityLabel;
  status: StatusLabel;
  verification: VerificationLabel;
  createdAt: string;
  updatedAt: string;
  activity: ActivityDTO[];
}

/** Public map marker (nearby feed). Deliberately omits the tracking reference. */
export interface MapIncidentDTO {
  id: string;
  title: string;
  category: CategoryLabel;
  currentSeverity: SeverityLabel;
  status: StatusLabel;
  locationText: string;
  coordinates: Coordinates;
  distanceMeters: number;
  createdAt: string;
}

/** Mirrors `Hotspot` in src/utils/hotspots.ts, plus severity weighting. */
export interface HotspotDTO {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  accidents: number;
  categories: Record<string, number>;
  topCategory: string;
  lastReportedAt: string;
  /** Sum of severity weights (Low 1, Medium 2, High 4, Critical 8). */
  weight: number;
  critical: number;
  /** Cluster extent (density mode) or half the cell diagonal (grid mode). */
  radiusMeters: number;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AnalyticsDTO {
  range: { from: string; to: string };
  totals: {
    total: number;
    criticalPriorityOpen: number;
    assigned: number;
    availableTeams: number;
    busyTeams: number;
    open: number;
    criticalOpen: number;
    pending: number;
    inProgress: number;
    resolved: number;
    awaitingVerification: number;
  };
  responseTimes: {
    /** Seconds from report to first "In Progress". */
    avgFirstResponseSec: number | null;
    medianFirstResponseSec: number | null;
    p90FirstResponseSec: number | null;
    /** Seconds from report to "Resolved". */
    avgResolutionSec: number | null;
    medianResolutionSec: number | null;
  };
  responseTeams: { avgAssignSec: number | null };
  byPriority: { name: PriorityLabel; count: number }[];
  teamAvailability: { name: TeamCategoryLabel; Available: number; Busy: number }[];
  weekly: { week: string; reported: number; resolved: number }[];
  byCategory: { name: CategoryLabel; count: number }[];
  byStatus: { name: StatusLabel; value: number }[];
  bySeverity: { name: SeverityLabel; count: number }[];
  daily: { date: string; reported: number; resolved: number }[];
  recentActivity: (ActivityDTO & { incidentId: string; reference: string })[];
}
