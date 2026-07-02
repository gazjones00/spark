import { HttpTimeoutError } from "@spark/common";
import { TrueLayerAuthError, TrueLayerRateLimitError } from "@spark/truelayer/server";
import type {
  Account,
  Balance,
  GetAccountsOptions,
  GetBalanceOptions,
  GetTransactionsOptions,
  RevokeAccessOptions,
  Transaction,
} from "@spark/truelayer/server";
import {
  ConnectorAuthError,
  ConnectorError,
  ConnectorRateLimitError,
  ConnectorTimeoutError,
  emptyConnectorSyncResult,
  type ConnectorSyncContext,
  type ConnectorSyncResult,
  type FinancialConnector,
} from "../core/index.ts";
import { TRUELAYER_ENVIRONMENTS, TRUELAYER_MANIFEST, TRUELAYER_PROVIDER_ID } from "./constants.ts";
import {
  createTrueLayerRawRecord,
  mapTrueLayerAccount,
  mapTrueLayerBalanceSnapshot,
  mapTrueLayerTransaction,
  truelayerTransactionExternalId,
} from "./mappers.ts";

/** How far back the first sync of a connection reaches. */
export const TRUELAYER_HISTORICAL_DAYS = 90;
/** Regular incremental lookback when the checkpoint is fresh. */
const DEFAULT_SYNC_DAYS = 7;
/** Hard cap on the lookback window (TrueLayer data availability). */
const MAX_SYNC_DAYS = 90;
/** Overlap so boundary transactions are not missed; upserts dedupe. */
const CHECKPOINT_OVERLAP_DAYS = 1;

/** The subset of the TrueLayer client the connector needs. */
export interface TrueLayerConnectorClient {
  getAccounts(options: GetAccountsOptions): Promise<Account[]>;
  getTransactions(options: GetTransactionsOptions): Promise<Transaction[]>;
  getBalance(options: GetBalanceOptions): Promise<Balance>;
  revokeAccess(options: RevokeAccessOptions): Promise<void>;
}

/**
 * Supplies a valid access token for a sync context. The server-side
 * implementation owns refresh (single-flight per connection, RFC 6749 §6
 * refresh-token retention) and persists rotated credentials back onto the
 * connection — the connector itself never sees refresh mechanics.
 */
export interface TrueLayerTokenProvider {
  getAccessToken(context: ConnectorSyncContext): Promise<string>;
}

export interface TrueLayerConnectorOptions {
  client: TrueLayerConnectorClient;
  tokenProvider: TrueLayerTokenProvider;
}

export class TrueLayerConnector implements FinancialConnector {
  readonly manifest = TRUELAYER_MANIFEST;
  private readonly client: TrueLayerConnectorClient;
  private readonly tokenProvider: TrueLayerTokenProvider;

  constructor(options: TrueLayerConnectorOptions) {
    this.client = options.client;
    this.tokenProvider = options.tokenProvider;
  }

  async testConnection(context: ConnectorSyncContext): Promise<void> {
    this.assertEnvironment(context);
    const accessToken = await this.tokenProvider.getAccessToken(context);
    try {
      await this.client.getAccounts({ accessToken });
    } catch (error) {
      throw classifyError(error);
    }
  }

  /**
   * Kills the open-banking grant at TrueLayer. Resolving the token first may
   * itself refresh; if that refresh fails with `invalid_grant` the token
   * provider throws `ConnectorAuthError` — the grant is already dead, which
   * callers treat as the goal state.
   */
  async revoke(context: ConnectorSyncContext): Promise<void> {
    this.assertEnvironment(context);
    const accessToken = await this.tokenProvider.getAccessToken(context);
    try {
      await this.client.revokeAccess({ accessToken });
    } catch (error) {
      throw classifyError(error);
    }
  }

  async sync(context: ConnectorSyncContext): Promise<ConnectorSyncResult> {
    this.assertEnvironment(context);
    const now = context.requestedAt ?? new Date();
    const observedAt = now.toISOString();
    const accessToken = await this.tokenProvider.getAccessToken(context);
    const result = emptyConnectorSyncResult(TRUELAYER_PROVIDER_ID, context.connectionId);

    let accounts: Account[];
    try {
      accounts = await this.client.getAccounts({ accessToken });
    } catch (error) {
      throw classifyError(error);
    }

    for (const account of this.selectAccounts(accounts, context)) {
      result.accounts.push(mapTrueLayerAccount(account));
      result.rawRecords.push(
        createTrueLayerRawRecord("accounts", account.accountId, observedAt, account),
      );

      try {
        const balance = await this.client.getBalance({
          accessToken,
          accountId: account.accountId,
          accountType: account.accountType,
        });
        result.balanceSnapshots.push(
          mapTrueLayerBalanceSnapshot(account.accountId, balance, observedAt),
        );
        result.rawRecords.push(
          createTrueLayerRawRecord("balance", account.accountId, observedAt, balance),
        );
      } catch (error) {
        this.recordAccountError(result, "balance", account.accountId, error);
      }

      try {
        const window = this.transactionWindow(context, account.accountId, now);
        const transactions = await this.client.getTransactions({
          accessToken,
          accountId: account.accountId,
          accountType: account.accountType,
          from: window.from,
          to: window.to,
        });
        for (const transaction of transactions) {
          result.transactions.push(mapTrueLayerTransaction(account.accountId, transaction));
          result.rawRecords.push(
            createTrueLayerRawRecord(
              "transactions",
              truelayerTransactionExternalId(transaction.transactionId),
              observedAt,
              transaction,
            ),
          );
        }
        // Advance the per-account checkpoint only after a successful fetch.
        result.cursors.push({
          resource: transactionsResource(account.accountId),
          cursor: null,
          checkpoint: observedAt,
        });
      } catch (error) {
        this.recordAccountError(result, "transactions", account.accountId, error);
      }
    }

    return result;
  }

  /**
   * Honours the accountIds allow-list captured at connect time (the accounts
   * the user selected). Absent list = sync everything the consent covers; a
   * present (even empty) list is authoritative, so a user-deleted account is
   * not resurrected by the next sync.
   */
  private selectAccounts(accounts: Account[], context: ConnectorSyncContext): Account[] {
    const accountIds = context.metadata?.accountIds;
    if (!Array.isArray(accountIds)) {
      return accounts;
    }
    const allowed = new Set(accountIds.filter((id): id is string => typeof id === "string"));
    return accounts.filter((account) => allowed.has(account.accountId));
  }

  /**
   * Incremental window derived from the per-account cursor checkpoint,
   * mirroring the bespoke TransactionSyncService.calculateFromDate semantics:
   * no checkpoint → full historical window; stale checkpoint → capped at
   * MAX_SYNC_DAYS; fresh checkpoint → at least DEFAULT_SYNC_DAYS, with a
   * one-day overlap so boundary transactions are re-fetched (upserts dedupe).
   */
  private transactionWindow(
    context: ConnectorSyncContext,
    accountId: string,
    now: Date,
  ): { from: string; to: string } {
    const checkpoint = context.cursors?.find(
      (cursor) => cursor.resource === transactionsResource(accountId),
    )?.checkpoint;

    const to = now;
    let from: Date;
    if (!checkpoint) {
      from = addDays(now, -TRUELAYER_HISTORICAL_DAYS);
    } else {
      const lastSyncedAt = new Date(checkpoint);
      const defaultFrom = addDays(now, -DEFAULT_SYNC_DAYS);
      const maxFrom = addDays(now, -MAX_SYNC_DAYS);
      if (Number.isNaN(lastSyncedAt.getTime()) || lastSyncedAt < maxFrom) {
        from = maxFrom;
      } else if (lastSyncedAt >= defaultFrom) {
        from = defaultFrom;
      } else {
        from = addDays(lastSyncedAt, -CHECKPOINT_OVERLAP_DAYS);
      }
    }

    return { from: formatDate(from), to: formatDate(to) };
  }

  private recordAccountError(
    result: ConnectorSyncResult,
    resource: string,
    accountId: string,
    error: unknown,
  ): never | void {
    const classified = classifyError(error);
    // Auth failures cover the whole consent, not one account — fail the sync
    // so persistence marks the connection NEEDS_REAUTH. Rate limits likewise
    // throttle the whole client, so continuing to the next account would
    // amplify load; fail the sync and let the scheduler back off on the hint.
    if (classified instanceof ConnectorAuthError || classified instanceof ConnectorRateLimitError) {
      throw classified;
    }
    result.status = "partial";
    result.errors.push({
      code: classified instanceof ConnectorError ? classified.code : "CONNECTOR_ERROR",
      message: classified.message,
      resource: `${resource}:${accountId}`,
    });
  }

  private assertEnvironment(context: ConnectorSyncContext): void {
    if (!(context.environment in TRUELAYER_ENVIRONMENTS)) {
      throw new ConnectorAuthError(
        `TrueLayer does not support the ${context.environment} environment.`,
      );
    }
  }
}

export function transactionsResource(accountId: string): string {
  return `transactions:${accountId}`;
}

/**
 * Bank-side auth failures (401/403, revoked consent) → NEEDS_REAUTH;
 * 429 → rate-limited with the provider's backoff hint preserved;
 * request deadline exceeded → transient timeout.
 */
function classifyError(error: unknown): Error {
  if (error instanceof ConnectorError) {
    return error;
  }
  if (error instanceof TrueLayerAuthError) {
    return new ConnectorAuthError(error.message, error);
  }
  if (error instanceof TrueLayerRateLimitError) {
    return new ConnectorRateLimitError(error.message, {
      retryAfterMs: error.retryAfterMs,
      cause: error,
    });
  }
  if (error instanceof HttpTimeoutError) {
    return new ConnectorTimeoutError(error.message, error);
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** UTC day arithmetic — formatDate truncates in UTC, and local setDate would
 * drift the window by a day across DST transitions. */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0] ?? date.toISOString();
}
