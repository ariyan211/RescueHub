export const CATEGORIES = [
  "Fire",
  "Road Accident",
  "Medical Emergency",
  "Flood",
  "Building Collapse",
  "Other Emergency",
] as const;
export const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
export const STATUSES = ["Reported", "Pending", "In Progress", "Resolved"] as const;
export const VERIFICATIONS = ["Unverified", "Under Review", "Verified"] as const;
export const SAFETY_ANSWERS = ["Yes", "No", "Unknown"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type IncidentStatus = (typeof STATUSES)[number];
export type Verification = (typeof VERIFICATIONS)[number];
export type SafetyAnswer = (typeof SAFETY_ANSWERS)[number];

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
    | "assigned"
    | "note";
  message: string;
  /** "Reporter", "System", or a staff display name when served by the API. */
  actor: "Reporter" | "System" | "Demo administrator" | (string & {});
  timestamp: string;
}

export interface Incident {
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
