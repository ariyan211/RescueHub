import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";
import { conflict, unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface TokenClaims {
  sub: string;
  name: string;
  email: string;
  role: Role;
}

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", BCRYPT_ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

export function signToken(user: AuthUser): string {
  const claims: TokenClaims = { sub: user.id, name: user.name, email: user.email, role: user.role };
  return jwt.sign(claims, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
  });
}

export function verifyToken(token: string): AuthUser {
  try {
    const claims = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
    }) as TokenClaims;
    return { id: claims.sub, name: claims.name, email: claims.email, role: claims.role };
  } catch {
    throw unauthorized("Invalid or expired token");
  }
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) throw unauthorized("Invalid email or password");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const authUser: AuthUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  return { token: signToken(authUser), user: authUser };
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("A user with this email already exists");
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return user;
}

export function listStaff() {
  return prisma.user.findMany({
    where: { active: true, role: { in: ["DISPATCHER", "RESPONDER", "ADMIN"] } },
    select: { id: true, name: true, email: true, role: true, lastLoginAt: true },
    orderBy: { name: "asc" },
  });
}
