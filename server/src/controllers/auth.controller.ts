import type { Request, Response } from "express";
import { currentUser } from "../middleware/auth.js";
import { createUserSchema, loginSchema } from "../schemas/auth.schemas.js";
import * as auth from "../services/auth.service.js";

/** POST /api/v1/auth/login */
export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  res.json({ data: await auth.login(email, password) });
}

/** GET /api/v1/auth/me */
export function me(req: Request, res: Response) {
  res.json({ data: currentUser(req) });
}

/** GET /api/v1/admin/users — staff directory for the assignment picker. */
export async function listUsers(_req: Request, res: Response) {
  res.json({ data: await auth.listStaff() });
}

/** POST /api/v1/admin/users — ADMIN only. */
export async function createUser(req: Request, res: Response) {
  const input = createUserSchema.parse(req.body);
  res.status(201).json({ data: await auth.createUser(input) });
}
