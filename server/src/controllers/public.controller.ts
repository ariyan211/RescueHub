import type { Request, Response } from "express";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import { createUploadTarget } from "../lib/storage.js";
import { env } from "../config/env.js";
import {
  hotspotQuerySchema,
  nearbyQuerySchema,
  presignSchema,
  reportIncidentSchema,
  trackingParamsSchema,
} from "../schemas/incident.schemas.js";
import * as geo from "../services/geo.service.js";
import * as incidents from "../services/incident.service.js";

const idempotencyKey = z.string().trim().min(8).max(100).optional();

/** POST /api/v1/incidents/report */
export async function report(req: Request, res: Response) {
  const input = reportIncidentSchema.parse(req.body);
  const key = idempotencyKey.parse(req.get("Idempotency-Key") || undefined);
  const incident = await incidents.reportIncident(input, key);
  // The reporter gets their own submission back (including contact details they entered).
  res.status(201).location(`/api/v1/incidents/track/${incident.reference}`).json({
    data: incident,
    trackingCode: incident.reference,
  });
}

/** GET /api/v1/incidents/track/:trackingCode */
export async function track(req: Request, res: Response) {
  const { trackingCode } = trackingParamsSchema.parse(req.params);
  res.set("Cache-Control", "no-store");
  res.json({ data: await incidents.findByTrackingCode(trackingCode) });
}

/** POST /api/v1/uploads/presigned-url */
export async function presign(req: Request, res: Response) {
  const { contentType, sizeBytes } = presignSchema.parse(req.body);
  if (sizeBytes && sizeBytes > env.UPLOAD_MAX_BYTES)
    throw badRequest(`Files must be ${Math.floor(env.UPLOAD_MAX_BYTES / 1024 / 1024)} MB or smaller`);
  res.status(201).json({ data: await createUploadTarget(contentType) });
}

/** GET /api/v1/incidents/nearby?lat=&lng=&radius= */
export async function nearby(req: Request, res: Response) {
  const q = nearbyQuerySchema.parse(req.query);
  res.set("Cache-Control", "public, max-age=15");
  res.json({ data: await geo.nearby(q) });
}

/** GET /api/v1/incidents/hotspots */
export async function hotspots(req: Request, res: Response) {
  const q = hotspotQuerySchema.parse(req.query);
  res.set("Cache-Control", "public, max-age=60");
  res.json({ data: await geo.hotspots(q) });
}

/** GET /api/v1/incidents/summary — public counters for HomePage. */
export async function summary(_req: Request, res: Response) {
  res.set("Cache-Control", "public, max-age=30");
  res.json({ data: await incidents.publicSummary() });
}
