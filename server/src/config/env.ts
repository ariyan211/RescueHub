import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  JWT_ISSUER: z.string().default("responsehub-api"),

  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  S3_FORCE_PATH_STYLE: bool,
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),

  /** OSRM routing server. No API key. Self-host for production (public demo is fair-use only). */
  OSRM_URL: z
    .string()
    .url()
    .default("https://router.project-osrm.org")
    .transform((v) => v.replace(/\/$/, "")),
  OSRM_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(6000),
  /** How often unresolved incidents are re-prioritised for waiting time. */
  PRIORITY_REFRESH_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
