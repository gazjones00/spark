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

export class ConnectorRateLimitError extends ConnectorError {
  constructor(message = "Connector rate limit exceeded.", cause?: unknown) {
    super(message, "CONNECTOR_RATE_LIMIT_ERROR", cause);
    this.name = "ConnectorRateLimitError";
  }
}

export class ConnectorSchemaError extends ConnectorError {
  constructor(message = "Connector response did not match the expected schema.", cause?: unknown) {
    super(message, "CONNECTOR_SCHEMA_ERROR", cause);
    this.name = "ConnectorSchemaError";
  }
}
