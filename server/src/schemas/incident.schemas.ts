import { z } from "zod";
import * as E from "../domain/enums.js";
import { ALLOWED_CONTENT_TYPES, UPLOAD_KEY_PATTERN, type AllowedContentType } from "../lib/storage.js";

/** Accepts a frontend label ("Road Accident") and yields the DB enum ("ROAD_ACCIDENT"). */
function labelEnum<D extends string, L extends string>(map: {
  labels: [L, ...L[]];
  toDb: (l: L) => D;
}) {
  return z.enum(map.labels).transform((l) => map.toDb(l));
}

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(item));

const text = (max: number) => z.string().trim().min(1).max(max);
export const latitude = z.coerce.number().min(-90).max(90);
export const longitude = z.coerce.number().min(-180).max(180);

// ---------- Public ----------

/** Matches `NewIncidentInput` from the frontend, with `mediaKeys` instead of data-URL photos. */
export const reportIncidentSchema = z
  .object({
    title: text(160),
    description: text(5000),
    category: labelEnum(E.category),
    locationText: text(300),
    coordinates: z.object({ latitude, longitude }).optional(),
    peopleAffected: z.coerce.number().int().min(0).max(100_000),
    immediateThreat: labelEnum(E.safety),
    peopleTrapped: labelEnum(E.safety),
    ongoingHazard: labelEnum(E.safety),
    contactName: z.string().trim().max(120).optional(),
    contactDetails: z.string().trim().max(200).optional(),
    /** Object keys returned by POST /uploads/presigned-url. */
    mediaKeys: z
      .array(z.string().regex(UPLOAD_KEY_PATTERN, "Unknown media key"))
      .max(5)
      .default([])
      .refine((keys) => new Set(keys).size === keys.length, "Duplicate media keys"),
  })
  .strict();
export type ReportIncidentInput = z.infer<typeof reportIncidentSchema>;

export const trackingParamsSchema = z.object({ trackingCode: z.string().trim().min(6).max(40) });

export const presignSchema = z.object({
  contentType: z.enum(Object.keys(ALLOWED_CONTENT_TYPES) as [AllowedContentType, ...AllowedContentType[]]),
  sizeBytes: z.coerce.number().int().positive().optional(),
});

export const nearbyQuerySchema = z.object({
  lat: latitude,
  lng: longitude,
  /** Meters. Defaults to 5 km, capped at 50 km. */
  radius: z.coerce.number().positive().max(50_000).default(5_000),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  category: csv(labelEnum(E.category)).optional(),
});

const bbox = z
  .string()
  .transform((v) => v.split(",").map(Number))
  .pipe(
    z.tuple([longitude, latitude, longitude, latitude]).refine(([w, s, e, n]) => w < e && s < n, {
      message: "bbox must be minLng,minLat,maxLng,maxLat",
    }),
  );

export const hotspotQuerySchema = z.object({
  /** "grid" matches the frontend's computeHotspots(); "density" uses ST_ClusterDBSCAN. */
  mode: z.enum(["grid", "density"]).default("grid"),
  /** Grid cell size in degrees (frontend default 0.03 ≈ 3 km). */
  cell: z.coerce.number().min(0.001).max(1).default(0.03),
  /** Density mode: neighbour distance in meters and minimum cluster size. */
  eps: z.coerce.number().min(50).max(20_000).default(750),
  minPoints: z.coerce.number().int().min(2).max(100).default(3),
  days: z.coerce.number().int().min(1).max(3650).default(90),
  includeResolved: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  category: csv(labelEnum(E.category)).optional(),
  bbox: bbox.optional(),
});

// ---------- Admin ----------

export const idParamsSchema = z.object({ id: z.string().uuid() });

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: csv(labelEnum(E.status)).optional(),
  severity: csv(labelEnum(E.severity)).optional(),
  category: csv(labelEnum(E.category)).optional(),
  verification: csv(labelEnum(E.verification)).optional(),
  assigneeId: z.union([z.string().uuid(), z.literal("me"), z.literal("unassigned")]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(200).optional(),
  sort: z
    .enum(["createdAt", "-createdAt", "updatedAt", "-updatedAt", "severity", "-severity"])
    .default("-createdAt"),
});
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export const statusUpdateSchema = z
  .object({
    status: labelEnum(E.status),
    /** Optional note recorded with the change (private to staff unless notePublic). */
    note: z.string().trim().max(2000).optional(),
    notePublic: z.boolean().default(false),
  })
  .strict();

export const verificationUpdateSchema = z
  .object({ verification: labelEnum(E.verification) })
  .strict();

export const severityUpdateSchema = z
  .object({ severity: labelEnum(E.severity), reason: text(500) })
  .strict();

export const noteSchema = z
  .object({ message: text(2000), isPublic: z.boolean().default(false) })
  .strict();

export const assignSchema = z.object({ assigneeId: z.string().uuid().nullable() }).strict();

export const analyticsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
