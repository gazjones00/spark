import { isDefinedError, ORPCError } from "@orpc/client";
import type { Account } from "@spark/truelayer/types";

/**
 * Maps a connect-flow failure to user-facing copy, branching structurally on
 * the contract's typed error channels (never on error.message contents).
 * Returns `recoverable: true` when restarting the connect flow is the fix,
 * so the UI can show a reconnect CTA instead of a dead-end error.
 */
export function describeConnectError(error: unknown): { message: string; recoverable: boolean } {
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
