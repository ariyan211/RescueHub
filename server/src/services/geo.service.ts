import { Prisma, type IncidentCategory, type IncidentStatus, type Severity } from "@prisma/client";
import type { HotspotDTO, MapIncidentDTO } from "../domain/contract.js";
import * as E from "../domain/enums.js";
import { prisma } from "../lib/prisma.js";

const point = (lat: number, lng: number) =>
  Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography`;

const categoryFilter = (categories?: IncidentCategory[]) =>
  categories?.length
    ? Prisma.sql`AND i."category"::text IN (${Prisma.join(categories)})`
    : Prisma.empty;

// ---------------------------------------------------------------------------
// Nearby: active incidents within a radius (GiST-indexed ST_DWithin)
// ---------------------------------------------------------------------------

interface NearbyRow {
  id: string;
  title: string;
  category: IncidentCategory;
  currentSeverity: Severity;
  status: IncidentStatus;
  locationText: string;
  latitude: number;
  longitude: number;
  distance: number;
  createdAt: Date;
}

export async function nearby(params: {
  lat: number;
  lng: number;
  radius: number;
  limit: number;
  category?: IncidentCategory[];
}): Promise<MapIncidentDTO[]> {
  const origin = point(params.lat, params.lng);
  const rows = await prisma.$queryRaw<NearbyRow[]>`
    SELECT i.id, i.title, i.category, i."currentSeverity", i.status, i."locationText",
           i.latitude, i.longitude, i."createdAt",
           ST_Distance(i.location, ${origin}) AS distance
    FROM "Incident" i
    WHERE i."deletedAt" IS NULL
      AND i.status <> 'RESOLVED'
      AND i.location IS NOT NULL
      AND ST_DWithin(i.location, ${origin}, ${params.radius}::float8)
      ${categoryFilter(params.category)}
    ORDER BY distance ASC
    LIMIT ${params.limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: E.category.toLabel(r.category),
    currentSeverity: E.severity.toLabel(r.currentSeverity),
    status: E.status.toLabel(r.status),
    locationText: r.locationText,
    coordinates: { latitude: r.latitude, longitude: r.longitude },
    distanceMeters: Math.round(r.distance),
    createdAt: r.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Hotspots
// ---------------------------------------------------------------------------

export interface HotspotParams {
  mode: "grid" | "density";
  cell: number;
  eps: number;
  minPoints: number;
  days: number;
  includeResolved: boolean;
  category?: IncidentCategory[];
  bbox?: [number, number, number, number];
}

interface ClusterRow {
  key: string;
  latitude: number;
  longitude: number;
  count: number;
  weight: number;
  critical: number;
  radius: number;
  last: Date;
  categories: Record<IncidentCategory, number>;
}

const SEVERITY_WEIGHT_SQL = Prisma.sql`
  CASE i."currentSeverity"
    WHEN 'CRITICAL' THEN ${E.SEVERITY_WEIGHT.CRITICAL}::int
    WHEN 'HIGH'     THEN ${E.SEVERITY_WEIGHT.HIGH}::int
    WHEN 'MEDIUM'   THEN ${E.SEVERITY_WEIGHT.MEDIUM}::int
    ELSE ${E.SEVERITY_WEIGHT.LOW}::int
  END`;

function baseFilter(p: HotspotParams) {
  const since = new Date(Date.now() - p.days * 86_400_000);
  return Prisma.sql`
    i."deletedAt" IS NULL
    AND i.location IS NOT NULL
    AND i."createdAt" >= ${since}
    ${p.includeResolved ? Prisma.empty : Prisma.sql`AND i.status <> 'RESOLVED'`}
    ${categoryFilter(p.category)}
    ${
      p.bbox
        ? Prisma.sql`AND i.location && ST_MakeEnvelope(${p.bbox[0]}::float8, ${p.bbox[1]}::float8, ${p.bbox[2]}::float8, ${p.bbox[3]}::float8, 4326)::geography`
        : Prisma.empty
    }`;
}

/**
 * Grid mode reproduces src/utils/hotspots.ts exactly (floor(lat / cell) buckets,
 * centred on the cell) so the HotspotMap renders identically, but runs in SQL
 * over the whole dataset and adds severity weighting.
 */
function gridQuery(p: HotspotParams) {
  return prisma.$queryRaw<ClusterRow[]>`
    WITH pts AS (
      SELECT floor(i.latitude / ${p.cell}::float8)::int AS r,
             floor(i.longitude / ${p.cell}::float8)::int AS c,
             i.category, i."currentSeverity", i."createdAt",
             ${SEVERITY_WEIGHT_SQL} AS w
      FROM "Incident" i
      WHERE ${baseFilter(p)}
    ),
    per_cat AS (
      SELECT r, c, category, count(*)::int AS n FROM pts GROUP BY r, c, category
    ),
    cells AS (
      SELECT r, c,
             count(*)::int AS count,
             sum(w)::int AS weight,
             (count(*) FILTER (WHERE "currentSeverity" = 'CRITICAL'))::int AS critical,
             max("createdAt") AS last
      FROM pts GROUP BY r, c
    )
    SELECT cells.r || ':' || cells.c AS key,
           (cells.r + 0.5) * ${p.cell}::float8 AS latitude,
           (cells.c + 0.5) * ${p.cell}::float8 AS longitude,
           cells.count, cells.weight, cells.critical, cells.last,
           ST_Distance(
             ST_SetSRID(ST_MakePoint(cells.c * ${p.cell}::float8, cells.r * ${p.cell}::float8), 4326)::geography,
             ST_SetSRID(ST_MakePoint((cells.c + 1) * ${p.cell}::float8, (cells.r + 1) * ${p.cell}::float8), 4326)::geography
           ) / 2 AS radius,
           (SELECT jsonb_object_agg(pc.category, pc.n) FROM per_cat pc WHERE pc.r = cells.r AND pc.c = cells.c) AS categories
    FROM cells
    ORDER BY cells.count DESC, cells.weight DESC
    LIMIT 1000
  `;
}

/**
 * Density mode: DBSCAN clustering on Web-Mercator coordinates. Mercator
 * inflates distances by 1/cos(latitude), so eps is scaled by the mean latitude
 * of the candidate points to keep the neighbour distance roughly in true meters.
 */
function densityQuery(p: HotspotParams) {
  return prisma.$queryRaw<ClusterRow[]>`
    WITH pts AS (
      SELECT i.id, i.category, i."currentSeverity", i."createdAt",
             i.location::geometry AS geom,
             ${SEVERITY_WEIGHT_SQL} AS w
      FROM "Incident" i
      WHERE ${baseFilter(p)}
    ),
    scale AS (
      SELECT GREATEST(cos(radians(avg(ST_Y(geom)))), 0.01) AS k FROM pts
    ),
    clustered AS (
      SELECT pts.*,
             ST_ClusterDBSCAN(ST_Transform(geom, 3857), eps := ${p.eps}::float8 / (SELECT k FROM scale), minpoints := ${p.minPoints}::int) OVER () AS cid
      FROM pts
    ),
    clusters AS (
      SELECT cid,
             ST_Centroid(ST_Collect(geom)) AS centre,
             count(*)::int AS count,
             sum(w)::int AS weight,
             (count(*) FILTER (WHERE "currentSeverity" = 'CRITICAL'))::int AS critical,
             max("createdAt") AS last
      FROM clustered WHERE cid IS NOT NULL GROUP BY cid
    )
    SELECT 'c' || cl.cid AS key,
           ST_Y(cl.centre) AS latitude,
           ST_X(cl.centre) AS longitude,
           cl.count, cl.weight, cl.critical, cl.last,
           COALESCE((SELECT max(ST_Distance(x.geom::geography, cl.centre::geography)) FROM clustered x WHERE x.cid = cl.cid), 0) AS radius,
           (SELECT jsonb_object_agg(t.category, t.n)
              FROM (SELECT category, count(*)::int AS n FROM clustered x WHERE x.cid = cl.cid GROUP BY category) t) AS categories
    FROM clusters cl
    ORDER BY cl.weight DESC, cl.count DESC
    LIMIT 500
  `;
}

export async function hotspots(p: HotspotParams): Promise<HotspotDTO[]> {
  const rows = p.mode === "density" ? await densityQuery(p) : await gridQuery(p);
  return rows.map((r) => {
    const categories: Record<string, number> = {};
    for (const [cat, n] of Object.entries(r.categories ?? {}))
      categories[E.category.toLabel(cat as IncidentCategory)] = n;
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return {
      id: r.key,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      count: r.count,
      accidents: categories[E.category.toLabel("ROAD_ACCIDENT")] ?? 0,
      categories,
      topCategory,
      lastReportedAt: r.last.toISOString(),
      weight: r.weight,
      critical: r.critical,
      radiusMeters: Math.round(Number(r.radius)),
    };
  });
}
