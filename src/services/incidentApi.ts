/**
 * HTTP adapter for the Response Hub API. Drop-in replacement for the
 * localStorage functions in ./incidentService.ts — same operations, but async
 * and server-authoritative (severity, reference and timeline are computed by
 * the API, never by the browser).
 *
 *   incidentService.createIncident(input)        → reportIncident(input)
 *   incidentService.loadIncidents()              → listIncidents(filters)
 *   incidentService.updateStatus(incident, s)    → updateStatus(id, s)
 *   incidentService.updateVerification(...)      → updateVerification(id, v)
 *   incidentService.updateSeverity(...)          → updateSeverity(id, s, reason)
 *   incidentService.addNote(incident, note)      → addNote(id, note)
 *   (TrackPage lookup)                           → trackIncident(reference)
 *   (computeHotspots)                            → getHotspots(query)
 *
 * Configure with VITE_API_URL (e.g. http://localhost:4000).
 */
import type {
  Analytics,
  AdminIncidentFilters,
  ApiErrorBody,
  ApiHotspot,
  ApiIncident,
  AuthUser,
  HotspotQuery,
  MapIncident,
  Paginated,
  PublicIncident,
  PublicSummary,
  StaffSummary,
} from "../types/api";
import type {
  Category,
  IncidentStatus,
  NewIncidentInput,
  Severity,
  Verification,
} from "../types/incident";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const BASE = `${API_URL}/api/v1`;
const TOKEN_KEY = "responsehub.token";

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: token lives for this page only */
  }
}

type Query = Record<string, string | number | boolean | string[] | number[] | undefined | null>;

function toQueryString(query?: Query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options: { body?: unknown; query?: Query; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${toQueryString(options.query)}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", "Could not reach Response Hub. Check your connection.");
  }

  if (res.status === 204) return undefined as T;
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const error = (payload as ApiErrorBody | null)?.error;
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, error?.code ?? "HTTP_ERROR", error?.message ?? res.statusText, error?.details);
  }
  return payload as T;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// ---------------------------------------------------------------------------
// Media uploads (presigned POST straight to object storage)
// ---------------------------------------------------------------------------

interface UploadTarget {
  key: string;
  url: string;
  fields: Record<string, string>;
  maxBytes: number;
  expiresAt: string;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** Uploads one file (or a data URL from utils/image.compressImage) and returns its storage key. */
export async function uploadMedia(file: Blob | string): Promise<string> {
  const blob = typeof file === "string" ? await dataUrlToBlob(file) : file;
  const target = await data(
    request<{ data: UploadTarget }>("POST", "/uploads/presigned-url", {
      body: { contentType: blob.type || "image/jpeg", sizeBytes: blob.size },
    }),
  );
  if (blob.size > target.maxBytes) throw new ApiError(413, "TOO_LARGE", "This file is too large to upload.");

  const form = new FormData();
  for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
  form.append("file", blob); // must be the last field for S3 POST policies
  const res = await fetch(target.url, { method: "POST", body: form });
  if (!res.ok) throw new ApiError(res.status, "UPLOAD_FAILED", "A photo could not be uploaded. Please try again.");
  return target.key;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

function idempotencyKey() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Submits a report. `photos` may be data URLs (as produced by ReportPage
 * today) or Blobs; they are uploaded first, then referenced by key. Pass the
 * same `requestId` when retrying so a flaky connection never creates duplicates.
 */
export async function reportIncident(
  input: Omit<NewIncidentInput, "photos"> & { photos?: (string | Blob)[] },
  options: { requestId?: string } = {},
): Promise<ApiIncident> {
  const { photos = [], ...rest } = input;
  const mediaKeys = await Promise.all(photos.map(uploadMedia));
  return data(
    request<{ data: ApiIncident }>("POST", "/incidents/report", {
      body: { ...rest, mediaKeys },
      headers: { "Idempotency-Key": options.requestId ?? idempotencyKey() },
    }),
  );
}

export function trackIncident(reference: string, signal?: AbortSignal): Promise<PublicIncident> {
  return data(request("GET", `/incidents/track/${encodeURIComponent(reference.trim())}`, { signal }));
}

export function getNearbyIncidents(params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  category?: Category[];
  limit?: number;
}): Promise<MapIncident[]> {
  return data(
    request("GET", "/incidents/nearby", {
      query: {
        lat: params.latitude,
        lng: params.longitude,
        radius: params.radiusMeters,
        category: params.category,
        limit: params.limit,
      },
    }),
  );
}

export function getHotspots(query: HotspotQuery = {}): Promise<ApiHotspot[]> {
  return data(
    request("GET", "/incidents/hotspots", {
      query: { ...query, bbox: query.bbox?.join(","), includeResolved: query.includeResolved },
    }),
  );
}

export function getPublicSummary(): Promise<PublicSummary> {
  return data(request("GET", "/incidents/summary"));
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<AuthUser> {
  const result = await data(
    request<{ data: { token: string; user: AuthUser } }>("POST", "/auth/login", {
      body: { email, password },
    }),
  );
  setToken(result.token);
  return result.user;
}

export function logout() {
  setToken(null);
}

export function getCurrentUser(): Promise<AuthUser> {
  return data(request("GET", "/auth/me"));
}

// ---------------------------------------------------------------------------
// Staff console
// ---------------------------------------------------------------------------

export function listIncidents(filters: AdminIncidentFilters = {}): Promise<Paginated<ApiIncident>> {
  return request("GET", "/admin/incidents", { query: { ...filters } });
}

export function getIncident(id: string): Promise<ApiIncident> {
  return data(request("GET", `/admin/incidents/${id}`));
}

export function updateStatus(
  id: string,
  status: IncidentStatus,
  note?: { text: string; isPublic?: boolean },
): Promise<ApiIncident> {
  return data(
    request("PATCH", `/admin/incidents/${id}/status`, {
      body: { status, ...(note && { note: note.text, notePublic: note.isPublic ?? false }) },
    }),
  );
}

export function updateVerification(id: string, verification: Verification): Promise<ApiIncident> {
  return data(request("PATCH", `/admin/incidents/${id}/verification`, { body: { verification } }));
}

export function updateSeverity(id: string, severity: Severity, reason: string): Promise<ApiIncident> {
  return data(request("PATCH", `/admin/incidents/${id}/severity`, { body: { severity, reason } }));
}

export function addNote(id: string, message: string, isPublic = false): Promise<ApiIncident> {
  return data(request("POST", `/admin/incidents/${id}/notes`, { body: { message, isPublic } }));
}

export function assignIncident(id: string, assigneeId: string | null): Promise<ApiIncident> {
  return data(request("PATCH", `/admin/incidents/${id}/assignee`, { body: { assigneeId } }));
}

export function deleteIncident(id: string): Promise<void> {
  return request("DELETE", `/admin/incidents/${id}`);
}

export function getAnalytics(range: { from?: string; to?: string } = {}): Promise<Analytics> {
  return data(request("GET", "/admin/analytics", { query: range }));
}

export function listStaff(): Promise<(StaffSummary & { email: string })[]> {
  return data(request("GET", "/admin/users"));
}
