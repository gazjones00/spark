import { env } from "@spark/env/server";
import { pino } from "pino";
import { normalizeError, REDACTED } from "./redaction";

/**
 * pino redact paths (fast-redact syntax). `*` matches a single intermediate
 * level, so these catch top-level and one-level-nested secrets; anything
 * nested deeper inside error objects is handled by the `err` serializer
 * below, which drops payload-bearing fields entirely.
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "authorization",
  "cookie",
  "access_token",
  "refresh_token",
  "accessToken",
  "refreshToken",
  "client_secret",
  "clientSecret",
  "password",
  "*.authorization",
  "*.cookie",
  '*["set-cookie"]',
  "*.access_token",
  "*.refresh_token",
  "*.accessToken",
  "*.refreshToken",
  "*.client_secret",
  "*.clientSecret",
  "*.password",
];

/**
 * Shared pino options for BOTH processes (API + queue worker). Keep every
 * logging/redaction concern here so the two entrypoints cannot diverge.
 */
export const loggerOptions = {
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: REDACTED },
  serializers: {
    // Belt-and-braces with the redact paths: never serialise a raw error
    // object. `cause`/`response`/`config` can carry OAuth tokens and the
    // provider client secret on TrueLayer token-exchange failures.
    err: (error: unknown) => normalizeError(error),
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { singleLine: true } }
      : undefined,
} satisfies Parameters<typeof pino>[0];

export function createLogger() {
  return pino(loggerOptions);
}

/**
 * Single shared logger instance. Used directly where DI is not available
 * (module-level driver construction, the oRPC onError interceptor) and
 * handed to `nestjs-pino` so Nest logging flows through the same instance.
 */
export const rootLogger = createLogger();
