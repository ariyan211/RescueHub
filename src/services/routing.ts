/**
 * Road routing via OSRM (Open Source Routing Machine, OpenStreetMap data).
 *
 * Defaults to the free public demo server, which has a fair-use policy and no
 * uptime guarantee. For a real deployment run your own OSRM container and set
 * VITE_OSRM_URL (e.g. http://localhost:5000). No API key is needed.
 *
 * When routing is unavailable, callers fall back to the Haversine straight-line
 * distance and must label it as such (`source: "straight-line"`, no ETA).
 */
import { eligibleCandidates, type TeamCandidate } from "../domain/teams";
import { haversineKm } from "../domain/geo";
import type { Coordinates, Incident, RouteInfo } from "../types/incident";
import type { ResponseTeam } from "../types/team";

export const OSRM_URL = (
  (import.meta.env.VITE_OSRM_URL as string | undefined) || "https://router.project-osrm.org"
).replace(/\/$/, "");

const TIMEOUT_MS = 7000;
const MAX_POINTS = 400;

export interface RouteResult extends RouteInfo {
  /** [lat, lng] polyline. Straight line for the fallback. */
  geometry: [number, number][];
  /** Present when routing failed, explaining the fallback. */
  fallbackReason?: string;
}

const cache = new Map<string, Promise<RouteResult>>();
const key = (a: Coordinates, b: Coordinates) =>
  [a.latitude, a.longitude, b.latitude, b.longitude].map((n) => n.toFixed(5)).join(",");

function thin(points: [number, number][]) {
  if (points.length <= MAX_POINTS) return points;
  const step = Math.ceil(points.length / MAX_POINTS);
  const out = points.filter((_, i) => i % step === 0);
  if (out.at(-1) !== points.at(-1)) out.push(points.at(-1)!);
  return out;
}

export function straightLine(from: Coordinates, to: Coordinates, reason?: string): RouteResult {
  return {
    source: "straight-line",
    distanceKm: haversineKm(from, to),
    geometry: [
      [from.latitude, from.longitude],
      [to.latitude, to.longitude],
    ],
    ...(reason && { fallbackReason: reason }),
  };
}

async function requestRoute(from: Coordinates, to: Coordinates): Promise<RouteResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${OSRM_URL}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`routing service responded ${res.status}`);
    const body = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const route = body.routes?.[0];
    if (body.code !== "Ok" || !route) throw new Error(`no road route found (${body.code})`);
    return {
      source: "osrm",
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry: thin(route.geometry.coordinates.map(([lng, lat]) => [lat, lng])),
    };
  } catch (err) {
    const reason =
      (err as Error).name === "AbortError"
        ? "routing service timed out"
        : (err as Error).message || "routing service unavailable";
    return straightLine(from, to, reason);
  } finally {
    clearTimeout(timer);
  }
}

/** Road route from `from` to `to`; never throws (falls back to straight line). */
export function getRoute(from: Coordinates, to: Coordinates): Promise<RouteResult> {
  const k = key(from, to);
  let pending = cache.get(k);
  if (!pending) {
    pending = requestRoute(from, to);
    cache.set(k, pending);
    // Don't cache failures forever: retry fallbacks after a minute.
    void pending.then((r) => {
      if (r.source === "straight-line") setTimeout(() => cache.delete(k), 60_000);
    });
  }
  return pending;
}

export interface Recommendation {
  candidate: TeamCandidate;
  route: RouteResult;
  /** How the nearest team was chosen. */
  basis: "road-duration" | "straight-line";
  /** Other assignable teams with their routes, best first. */
  alternatives: { candidate: TeamCandidate; route: RouteResult }[];
}

/**
 * Nearest suitable available team:
 *   1. keep teams whose category handles this emergency and that are available;
 *   2. take the 4 nearest by Haversine distance;
 *   3. ask OSRM for road routes and pick the shortest drive time;
 *   4. if no road route is available, pick the nearest straight-line team.
 */
export async function recommendTeam(
  incident: Pick<Incident, "id" | "category" | "coordinates">,
  teams: ResponseTeam[],
): Promise<Recommendation | null> {
  if (!incident.coordinates) return null;
  const shortlist = eligibleCandidates(incident, teams).slice(0, 4);
  if (!shortlist.length) return null;
  const routed = await Promise.all(
    shortlist.map(async (candidate) => ({
      candidate,
      route: await getRoute(
        { latitude: candidate.team.latitude, longitude: candidate.team.longitude },
        incident.coordinates!,
      ),
    })),
  );
  const byRoad = routed.filter((r) => r.route.source === "osrm");
  const ordered = byRoad.length
    ? [
        ...byRoad.sort((a, b) => a.route.durationMin! - b.route.durationMin!),
        ...routed.filter((r) => r.route.source !== "osrm"),
      ]
    : routed;
  const [best, ...alternatives] = ordered;
  return {
    candidate: best!.candidate,
    route: best!.route,
    basis: byRoad.length ? "road-duration" : "straight-line",
    alternatives,
  };
}

/** Strips geometry so a route can be stored with an assignment. */
export const toRouteInfo = (r: RouteResult): RouteInfo => ({
  source: r.source,
  distanceKm: r.distanceKm,
  ...(r.durationMin !== undefined && { durationMin: r.durationMin }),
});
