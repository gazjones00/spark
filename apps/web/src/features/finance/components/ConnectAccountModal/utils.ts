import { isDefinedError, ORPCError } from "@orpc/client";
import type { Account } from "@spark/truelayer/types";

export interface ConnectErrorDetail {
  message: string;
  /** True when restarting the connect flow is the fix (expired session, reauth). */
  recoverable: boolean;
  /** Overrides the dialog heading when "error" would misdescribe what happened. */
  title?: string;
  description?: string;
}

/**
 * Maps a connect-flow failure to user-facing copy, branching structurally on
 * the contract's typed error channels (never on error.message contents).
 * Returns `recoverable: true` when restarting the connect flow is the fix,
 * so the UI can show a reconnect CTA instead of a dead-end error.
 */
export function describeConnectError(error: unknown): ConnectErrorDetail {
  if (error instanceof ORPCError && isDefinedError(error)) {
    switch (error.code) {
      case "INVALID_OAUTH_STATE":
        return {
          message: "Your bank connection session expired. Please reconnect to continue.",
          recoverable: true,
        };
      case "NEEDS_REAUTH":
        return {
          message: "This bank connection needs to be reauthorised. Please reconnect.",
          recoverable: true,
        };
      case "RATE_LIMITED":
        return {
          message: "Your bank is receiving too many requests. Please try again in a few minutes.",
          recoverable: false,
        };
      case "CONNECTOR_ERROR":
        return {
          message: "We couldn't sync this connection. Please try again later.",
          recoverable: false,
        };
    }
  }
  return {
    message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
    recoverable: false,
  };
}

/**
 * Maps the `error` code the API forwards from TrueLayer's auth dialog to
 * user-facing copy. A cancellation isn't framed as a failure; unrecognised
 * codes get a generic message, since the provider's code set can grow.
 */
export function describeCallbackError(error: string): ConnectErrorDetail {
  switch (error) {
    case "access_denied":
      return {
        title: "Connection Cancelled",
        description: "The bank connection wasn't completed.",
        message: "No accounts were connected. You can start again whenever you're ready.",
        recoverable: true,
      };
    case "temporarily_unavailable":
    case "server_error":
      return {
        message: "Your bank couldn't complete the connection. Please try again in a few minutes.",
        recoverable: false,
      };
    default:
      return {
        message: "We couldn't complete the bank connection. Please try again.",
        recoverable: false,
      };
  }
}

export function formatAccountNumber(account: Account): string | null {
  if (account.accountNumber.number && account.accountNumber.sortCode) {
    return `${account.accountNumber.sortCode} ${account.accountNumber.number}`;
  }
  if (
    account.accountNumber.number &&
    (account.accountType === "CREDIT_CARD" || account.accountType === "CHARGE_CARD")
  ) {
    const lastFour = account.accountNumber.number.replace(/\D/g, "").slice(-4);
    return `Card ending ••••${lastFour}`;
  }
  if (account.accountNumber.iban) {
    return `IBAN: ...${account.accountNumber.iban.slice(-4)}`;
  }
  return null;
}

export function formatAccountType(type?: string): string | null {
  if (!type) return null;
  return type.replace(/_/g, " ").toLowerCase();
}
