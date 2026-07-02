export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly code: string = "CONNECTOR_ERROR",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

export class ConnectorAuthError extends ConnectorError {
  constructor(message = "Connector authentication failed.", cause?: unknown) {
    super(message, "CONNECTOR_AUTH_ERROR", cause);
    this.name = "ConnectorAuthError";
  }
}

export interface ConnectorRateLimitErrorOptions {
  /** Provider backoff hint resolved to a relative delay; null when absent. */
  retryAfterMs?: number | null;
  cause?: unknown;
}

export class ConnectorRateLimitError extends ConnectorError {
  readonly retryAfterMs: number | null;

  constructor(
    message = "Connector rate limit exceeded.",
    options: ConnectorRateLimitErrorOptions = {},
  ) {
    super(message, "CONNECTOR_RATE_LIMIT_ERROR", options.cause);
    this.name = "ConnectorRateLimitError";
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

/** A provider request exceeded its deadline — transient, safe to retry. */
export class ConnectorTimeoutError extends ConnectorError {
  constructor(message = "Connector request timed out.", cause?: unknown) {
    super(message, "CONNECTOR_TIMEOUT", cause);
    this.name = "ConnectorTimeoutError";
  }
}

export class ConnectorSchemaError extends ConnectorError {
  constructor(message = "Connector response did not match the expected schema.", cause?: unknown) {
    super(message, "CONNECTOR_SCHEMA_ERROR", cause);
    this.name = "ConnectorSchemaError";
  }
}
