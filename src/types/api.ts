/**
 * Response Hub API contract (frontend copy of server/src/domain/contract.ts).
 * Every API incident is a superset of `Incident` from ./incident, so existing
 * components can render API data unchanged.
 */
import type {
  Activity,
  Category,
  Coordinates,
  Incident,
  IncidentStatus,
  Severity,
  Verification,
} from "./incident";

export type StaffRole = "DISPATCHER" | "RESPONDER" | "ADMIN";

export interface ApiActivity extends Activity {
  actorRole?: StaffRole;
  isPublic: boolean;
}

export interface ApiMedia {
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

/** Full incident for the staff console. */
export interface ApiIncident extends Omit<Incident, "activity"> {
  media: ApiMedia[];
  isAnonymous: boolean;
  assignee: StaffSummary | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  activity: ApiActivity[];
}

/** Redacted view returned by the public tracking endpoint. */
export interface PublicIncident
  extends Pick<
    Incident,
    | "reference"
    | "title"
    | "category"
    | "locationText"
    | "coordinates"
    | "currentSeverity"
    | "status"
    | "verification"
    | "createdAt"
    | "updatedAt"
  > {
  activity: ApiActivity[];
}

export interface MapIncident {
  id: string;
  title: string;
  category: Category;
  currentSeverity: Severity;
  status: IncidentStatus;
  locationText: string;
  coordinates: Coordinates;
  distanceMeters: number;
  createdAt: string;
}

/** Same shape as `Hotspot` in src/utils/hotspots.ts, plus severity weighting. */
export interface ApiHotspot {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  accidents: number;
  categories: Record<string, number>;
  topCategory: string;
  lastReportedAt: string;
  weight: number;
  critical: number;
  radiusMeters: number;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Analytics {
  range: { from: string; to: string };
  totals: {
    total: number;
    open: number;
    criticalOpen: number;
    pending: number;
    inProgress: number;
    resolved: number;
    awaitingVerification: number;
  };
  responseTimes: {
    avgFirstResponseSec: number | null;
    medianFirstResponseSec: number | null;
    p90FirstResponseSec: number | null;
    avgResolutionSec: number | null;
    medianResolutionSec: number | null;
  };
  byCategory: { name: Category; count: number }[];
  byStatus: { name: IncidentStatus; value: number }[];
  bySeverity: { name: Severity; count: number }[];
  daily: { date: string; reported: number; resolved: number }[];
  recentActivity: (ApiActivity & { incidentId: string; reference: string })[];
}

export interface PublicSummary {
  total: number;
  criticalOpen: number;
  inProgress: number;
  resolved: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole | "CITIZEN";
}

export interface AdminIncidentFilters {
  page?: number;
  pageSize?: number;
  status?: IncidentStatus[];
  severity?: Severity[];
  category?: Category[];
  verification?: Verification[];
  assigneeId?: string | "me" | "unassigned";
  from?: string;
  to?: string;
  q?: string;
  sort?: "createdAt" | "-createdAt" | "updatedAt" | "-updatedAt" | "severity" | "-severity";
}

export interface HotspotQuery {
  mode?: "grid" | "density";
  cell?: number;
  eps?: number;
  minPoints?: number;
  days?: number;
  includeResolved?: boolean;
  category?: Category[];
  /** [minLng, minLat, maxLng, maxLat] */
  bbox?: [number, number, number, number];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
