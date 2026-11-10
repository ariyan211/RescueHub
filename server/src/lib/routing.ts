/**
 * Road routing via OSRM. Uses OSRM_URL (self-hosted recommended; defaults to
 * the public demo server, which is fair-use only). Never throws: on failure it
 * returns the Haversine straight-line distance, flagged as such, with no ETA.
 */
import { env } from "../config/env.js";
import { haversineKm } from "../domain/teams.js";
import { logger } from "./logger.js";

type Point = { latitude: number; longitude: number };

export interface RouteResult {
  source: "osrm" | "straight-line";
  distanceKm: number;
  durationMin?: number;
  /** [lat, lng] pairs */
  geometry: [number, number][];
  fallbackReason?: string;
}

const cache = new Map<string, { at: number; route: RouteResult }>();
const TTL_MS = 10 * 60_000;

export function straightLine(from: Point, to: Point, reason?: string): RouteResult {
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

export async function getRoute(from: Point, to: Point): Promise<RouteResult> {
  const key = [from.latitude, from.longitude, to.latitude, to.longitude].map((n) => n.toFixed(5)).join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.route;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.OSRM_TIMEOUT_MS);
  try {
    const url = `${env.OSRM_URL}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "responsehub-api" } });
    if (!res.ok) throw new Error(`routing service responded ${res.status}`);
    const body = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = body.routes?.[0];
    if (body.code !== "Ok" || !r) throw new Error(`no road route found (${body.code})`);
    const route: RouteResult = {
      source: "osrm",
      distanceKm: r.distance / 1000,
      durationMin: r.duration / 60,
      geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
    cache.set(key, { at: Date.now(), route });
    return route;
  } catch (err) {
    const reason = (err as Error).name === "AbortError" ? "routing service timed out" : (err as Error).message;
    logger.warn({ reason }, "OSRM routing unavailable; using straight-line fallback");
    return straightLine(from, to, reason || "routing service unavailable");
  } finally {
    clearTimeout(timer);
  }
}
