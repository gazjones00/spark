import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    BULL_BOARD_PASSWORD: z.string().min(1),
    BULL_BOARD_USERNAME: z.string().min(1),
    CORS_ORIGIN: z.url(),
    DATABASE_URL: z.string().min(1),
    ENCRYPTION_KEY: z.string().length(64, "Encryption key must be 64 hex characters (32 bytes)"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /** Total-request deadline for upstream provider HTTP calls. */
    PROVIDER_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    /** BullMQ per-queue limiter: at most MAX jobs per DURATION_MS window. */
    QUEUE_LIMITER_MAX: z.coerce.number().int().positive().default(20),
    QUEUE_LIMITER_DURATION_MS: z.coerce.number().int().positive().default(1_000),
    /** Consecutive sync failures before a connection's breaker opens. */
    BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
    /** Cool-down before an open breaker allows a half-open probe sync. */
    BREAKER_COOLDOWN_MS: z.coerce.number().int().positive().default(120_000),
    SENTRY_DSN: z.url().optional(),
    REDIS_HOST: z.string(),
    REDIS_PORT: z.coerce.number(),
    TRUELAYER_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
    /** Max parallel jobs (i.e. financial syncs) per worker process. */
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
    TRUELAYER_CLIENT_ID: z.string().min(1),
    TRUELAYER_CLIENT_SECRET: z.string().min(1),
    TRUELAYER_REDIRECT_URI: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
