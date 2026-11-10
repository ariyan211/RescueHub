import { rateLimit } from "express-rate-limit";

const WINDOW = 15 * 60 * 1000;

const limiter = (limit: number, message: string) =>
  rateLimit({
    windowMs: WINDOW,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message } },
  });

// Generous enough that a household or shared NAT can still report several incidents.
export const reportLimiter = limiter(20, "Too many reports from this network. If this is an emergency, call your local emergency number.");
export const uploadLimiter = limiter(60, "Too many upload requests. Please wait and try again.");
// Limits brute-force enumeration of tracking codes.
export const trackLimiter = limiter(120, "Too many tracking lookups. Please wait and try again.");
export const loginLimiter = limiter(10, "Too many sign-in attempts. Please wait and try again.");
export const publicReadLimiter = limiter(600, "Too many requests. Please slow down.");
