/**
 * Shared redaction + error-normalisation helpers.
 *
 * Deliberately dependency-free: imported by the logger config, the BullMQ
 * driver and the Sentry reporter, so it must not pull any of them in.
 */

export const REDACTED = "[REDACTED]";

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "client_secret",
  "clientsecret",
  "password",
]);

const MAX_REDACT_DEPTH = 8;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

/**
 * Returns a deep copy of `value` with every sensitive key replaced by
 * `[REDACTED]`, regardless of nesting depth. Safe against cycles.
 */
export function redactSensitive(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (depth >= MAX_REDACT_DEPTH || seen.has(value)) {
    return REDACTED;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactSensitive(entry, depth + 1, seen);
  }
  return result;
}

export interface NormalizedError {
  name: string;
  message: string;
  code?: string | number;
  status?: number;
  stack?: string;
}

/**
 * Maps any thrown value to a safe `{ name, message, code, status, stack }`
 * shape. Payload-bearing fields (`cause`, `response`, `config`, ...) are
 * dropped on purpose: TrueLayer token-exchange errors stash the client
 * secret and raw OAuth tokens there.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    const { code, status } = error as Error & { code?: string | number; status?: number };
    const normalized: NormalizedError = {
      name: error.name,
      message: error.message,
    };
    if (typeof code === "string" || typeof code === "number") {
      normalized.code = code;
    }
    if (typeof status === "number") {
      normalized.status = status;
    }
    if (error.stack) {
      normalized.stack = error.stack;
    }
    return normalized;
  }

  if (typeof error === "string") {
    return { name: "Error", message: error };
  }

  return { name: "UnknownError", message: JSON.stringify(redactSensitive(error)) };
}
