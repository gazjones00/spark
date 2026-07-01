import * as Sentry from "@sentry/node";
import { env } from "@spark/env/server";
import { normalizeError, redactSensitive } from "./redaction";

let initialized = false;

/**
 * Initialise Sentry. A no-op when SENTRY_DSN is unset, so local/dev/test
 * environments boot and serve traffic without any tracker configured.
 * Call once at the top of each entrypoint (API + queue worker).
 */
export function initSentry(): void {
  if (initialized || !env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
  });
  initialized = true;
}

export function isSentryEnabled(): boolean {
  return initialized;
}

/**
 * Report an error to Sentry (no-op when unconfigured). The error is
 * normalised first so payload-bearing fields (`cause`/`response`/`config`)
 * never reach the tracker, and `extra` context is redacted.
 */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  if (!initialized) {
    return;
  }

  const normalized = normalizeError(error);
  const scrubbed = new Error(normalized.message);
  scrubbed.name = normalized.name;
  if (normalized.stack) {
    scrubbed.stack = normalized.stack;
  }

  Sentry.captureException(scrubbed, {
    extra: {
      ...(extra ? (redactSensitive(extra) as Record<string, unknown>) : {}),
      ...(normalized.code !== undefined ? { code: normalized.code } : {}),
      ...(normalized.status !== undefined ? { status: normalized.status } : {}),
    },
  });
}
