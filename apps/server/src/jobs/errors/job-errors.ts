import { UnrecoverableError } from "bullmq";

/**
 * Permanent errors - extend UnrecoverableError so BullMQ won't retry.
 * Use these when the failure requires user action to resolve.
 */

export class ConnectionNotFoundError extends UnrecoverableError {
  constructor(connectionId: string) {
    super(`Connection ${connectionId} not found`);
  }
}

export class TokenExpiredError extends UnrecoverableError {
  constructor(connectionId: string) {
    super(`Connection ${connectionId} expired and no refresh token available`);
  }
}

/**
 * Transient errors - regular Error so BullMQ will retry.
 * Use these for temporary failures that may succeed on retry.
 */

export class TokenRefreshError extends Error {
  constructor(connectionId: string, cause?: Error) {
    super(`Failed to refresh token for connection ${connectionId}`);
    this.name = "TokenRefreshError";
    this.cause = cause;
  }
}
