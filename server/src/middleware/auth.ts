import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { forbidden, unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { verifyToken, type AuthUser } from "../services/auth.service.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function bearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

/**
 * Verifies the JWT, then re-reads the user so deactivations and role changes
 * take effect immediately rather than when the token expires.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearerToken(req.headers.authorization);
  if (!token) throw unauthorized();
  const claims = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: claims.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user?.active) throw unauthorized("Account is disabled");
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
}

/** Must run after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Helper for handlers behind requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

/** Role groups used by the admin routes. */
export const STAFF: Role[] = ["DISPATCHER", "RESPONDER", "ADMIN"];
export const COORDINATORS: Role[] = ["DISPATCHER", "ADMIN"];
