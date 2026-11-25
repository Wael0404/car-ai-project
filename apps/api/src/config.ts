import "dotenv/config";
import { z } from "zod";

/**
 * All configuration is read from the environment once, validated, and typed.
 * The process refuses to start with a missing or invalid setting.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),
  /** Hugging Face token: enables 3D generation from photos (TRELLIS). */
  HF_TOKEN: z.string().optional(),
  AGENT_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),
  SMTP_URL: z.string().optional().default(""),
  MAIL_FROM: z.string().default("Car AI <no-reply@example.com>"),
  CORS_ORIGINS: z.string().optional().default(""),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", z.prettifyError(parsed.error));
  process.exit(1);
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === "production";

if (isProd && !config.SMTP_URL) {
  console.error("SMTP_URL is required in production to send login codes.");
  process.exit(1);
}
