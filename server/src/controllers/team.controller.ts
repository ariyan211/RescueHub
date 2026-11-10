import type { Request, Response } from "express";
import { currentUser } from "../middleware/auth.js";
import {
  assignTeamSchema,
  availabilitySchema,
  idParamsSchema,
  teamInputSchema,
  teamListQuerySchema,
} from "../schemas/incident.schemas.js";
import * as assignments from "../services/assignment.service.js";
import * as teams from "../services/team.service.js";

const id = (req: Request) => idParamsSchema.parse(req.params).id;

/** GET /api/v1/admin/teams?q=&category=&availability= */
export async function list(req: Request, res: Response) {
  res.json({ data: await teams.listTeams(teamListQuerySchema.parse(req.query)) });
}

/** GET /api/v1/admin/teams/:id */
export async function get(req: Request, res: Response) {
  res.json({ data: await teams.getTeam(id(req)) });
}

/** POST /api/v1/admin/teams */
export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await teams.createTeam(teamInputSchema.parse(req.body)) });
}

/** PUT /api/v1/admin/teams/:id */
export async function update(req: Request, res: Response) {
  res.json({ data: await teams.updateTeam(id(req), teamInputSchema.parse(req.body)) });
}

/** PATCH /api/v1/admin/teams/:id/availability */
export async function setAvailability(req: Request, res: Response) {
  const { availability } = availabilitySchema.parse(req.body);
  res.json({ data: await teams.setAvailability(id(req), availability) });
}

/** DELETE /api/v1/admin/teams/:id */
export async function remove(req: Request, res: Response) {
  await teams.deleteTeam(id(req));
  res.status(204).end();
}

/** GET /api/v1/admin/incidents/:id/recommendations */
export async function recommend(req: Request, res: Response) {
  res.json({ data: await assignments.recommendTeams(id(req)) });
}

/** POST /api/v1/admin/incidents/:id/assignments */
export async function assign(req: Request, res: Response) {
  const body = assignTeamSchema.parse(req.body);
  res.status(201).json({
    data: await assignments.assignTeam(id(req), body.teamId, body, currentUser(req)),
  });
}

/** DELETE /api/v1/admin/incidents/:id/assignments/current */
export async function unassign(req: Request, res: Response) {
  res.json({ data: await assignments.unassignTeam(id(req), currentUser(req)) });
}

/** GET /api/v1/admin/incidents/:id/route */
export async function route(req: Request, res: Response) {
  res.json({ data: await assignments.activeRoute(id(req)) });
}
