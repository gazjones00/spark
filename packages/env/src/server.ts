import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    BULL_BOARD_PASSWORD: z.string().min(1),
    BULL_BOARD_USERNAME: z.string().min(1),
    CORS_ORIGIN: z.url(),
    DATABASE_URL: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    REDIS_HOST: z.string(),
    REDIS_PORT: z.coerce.number(),
    TRUELAYER_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
    TRUELAYER_CLIENT_ID: z.string().min(1),
    TRUELAYER_CLIENT_SECRET: z.string().min(1),
    TRUELAYER_REDIRECT_URI: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
