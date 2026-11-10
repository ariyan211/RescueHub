import type { Request, Response } from "express";
import { currentUser } from "../middleware/auth.js";
import { forbidden } from "../lib/errors.js";
import {
  adminListQuerySchema,
  analyticsQuerySchema,
  assignSchema,
  idParamsSchema,
  noteSchema,
  severityUpdateSchema,
  statusUpdateSchema,
  verificationUpdateSchema,
} from "../schemas/incident.schemas.js";
import { analytics as computeAnalytics } from "../services/analytics.service.js";
import * as incidents from "../services/incident.service.js";

const id = (req: Request) => idParamsSchema.parse(req.params).id;

/** GET /api/v1/admin/incidents */
export async function list(req: Request, res: Response) {
  const query = adminListQuerySchema.parse(req.query);
  res.json(await incidents.listIncidents(query, currentUser(req)));
}

/** GET /api/v1/admin/incidents/:id */
export async function get(req: Request, res: Response) {
  res.json({ data: await incidents.getIncident(id(req)) });
}

/** PATCH /api/v1/admin/incidents/:id/status */
export async function updateStatus(req: Request, res: Response) {
  const body = statusUpdateSchema.parse(req.body);
  const data = await incidents.changeStatus(id(req), body.status, currentUser(req), {
    text: body.note,
    isPublic: body.notePublic,
  });
  res.json({ data });
}

/** PATCH /api/v1/admin/incidents/:id/verification */
export async function updateVerification(req: Request, res: Response) {
  const { verification } = verificationUpdateSchema.parse(req.body);
  res.json({ data: await incidents.changeVerification(id(req), verification, currentUser(req)) });
}

/** PATCH /api/v1/admin/incidents/:id/severity */
export async function updateSeverity(req: Request, res: Response) {
  const { severity, reason } = severityUpdateSchema.parse(req.body);
  res.json({ data: await incidents.changeSeverity(id(req), severity, reason, currentUser(req)) });
}

/** POST /api/v1/admin/incidents/:id/notes */
export async function addNote(req: Request, res: Response) {
  const { message, isPublic } = noteSchema.parse(req.body);
  res.status(201).json({ data: await incidents.addNote(id(req), message, isPublic, currentUser(req)) });
}

/** PATCH /api/v1/admin/incidents/:id/assignee */
export async function assign(req: Request, res: Response) {
  const { assigneeId } = assignSchema.parse(req.body);
  const user = currentUser(req);
  // Responders may only claim an incident for themselves.
  if (user.role === "RESPONDER" && assigneeId !== user.id) throw forbidden("Responders can only self-assign");
  res.json({ data: await incidents.assign(id(req), assigneeId, user) });
}

/** DELETE /api/v1/admin/incidents/:id */
export async function remove(req: Request, res: Response) {
  await incidents.softDelete(id(req), currentUser(req));
  res.status(204).end();
}

/** GET /api/v1/admin/analytics */
export async function analytics(req: Request, res: Response) {
  const range = analyticsQuerySchema.parse(req.query);
  res.json({ data: await computeAnalytics(range) });
}
