import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(12, "Password must be at least 12 characters").max(200),
    role: z.enum(["DISPATCHER", "RESPONDER", "ADMIN"]),
  })
  .strict();
