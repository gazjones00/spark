import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    CORS_ORIGIN: z.url(),
    DATABASE_URL: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    TRUELAYER_CLIENT_ID: z.string().min(1),
    TRUELAYER_CLIENT_SECRET: z.string().min(1),
    TRUELAYER_REDIRECT_URI: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
