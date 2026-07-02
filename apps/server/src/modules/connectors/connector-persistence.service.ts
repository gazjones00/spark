import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConnectorSyncResult } from "@spark/connectors";
import { SyncStatus } from "@spark/common";
import { env } from "@spark/env/server";
import { eq, type Database } from "@spark/db";
import {
  balanceSnapshots,
  connectorConnections,
  connectorSyncCursors,
  connectorSyncRuns,
  financialAccounts,
  financialTransactions,
  holdings,
  instruments,
  portfolioSnapshots,
  rawProviderRecords,
} from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../database";
import { TransactionRollupService } from "./transaction-rollup.service";

const CONNECTOR_SYNC_INTERVAL_MINUTES = 5;
const FAILED_CONNECTOR_RETRY_MINUTES = 30;
/** Rate-limit backoff when the provider sent no usable hint. */
const RATE_LIMIT_DEFAULT_BACKOFF_MS = 60_000;
/** Bounds on the honoured provider hint: a garbage/hostile
 * Retry-After can neither stall a connection for hours nor busy-loop it. */
const RATE_LIMIT_MIN_BACKOFF_MS = 1_000;
const RATE_LIMIT_MAX_BACKOFF_MS = 3_600_000;
/** Proportional jitter so throttled connections don't retry in lockstep. */
const BACKOFF_JITTER_RATIO = 0.1;

export interface PersistConnectorSyncResultInput {
  userId: string;
  connectionId: string;
  result: ConnectorSyncResult;
  startedAt?: Date;
}

export interface PersistConnectorSyncResultResult {
  syncRunId: string;
  recordsRead: number;
  recordsWritten: number;
}

type ConnectorPersistenceDb = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

@Injectable()
export class ConnectorPersistenceService {
  private readonly logger = new Logger(ConnectorPersistenceService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly rollupService: TransactionRollupService,
  ) {}

  async persistSyncResult(
    input: PersistConnectorSyncResultInput,
  ): Promise<PersistConnectorSyncResultResult> {
    return this.db.transaction((tx) => this.persistSyncResultInTransaction(tx, input));
  }

  private async persistSyncResultInTransaction(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
  ): Promise<PersistConnectorSyncResultResult> {
    const now = new Date();
    let recordsWritten = 0;

    recordsWritten += await this.persistRawRecords(db, input);
    recordsWritten += await this.persistAccounts(db, input);
    recordsWritten += await this.persistInstruments(db, input);
    recordsWritten += await this.persistTransactions(db, input);
    // Same transaction as the upserts: the dashboard aggregates can never be
    // observed out of step with the base rows.
    await this.rollupService.refreshForBatch(db, {
      userId: input.userId,
      connectionId: input.connectionId,
      transactions: input.result.transactions,
    });
    recordsWritten += await this.persistHoldings(db, input);
    recordsWritten += await this.persistBalanceSnapshots(db, input);
    recordsWritten += await this.persistPortfolioSnapshots(db, input);
    recordsWritten += await this.persistCursors(db, input, now);

    const firstError = input.result.errors.at(0);
    await this.updateConnectionSyncState(db, input, now, firstError);

    const syncRunId = crypto.randomUUID();
    await db.insert(connectorSyncRuns).values({
      id: syncRunId,
      connectionId: input.connectionId,
      userId: input.userId,
      providerId: input.result.providerId,
      status: input.result.status,
      recordsRead: input.result.rawRecords.length,
      recordsWritten,
      errorCode: firstError?.code ?? null,
      errorMessage: firstError?.message ?? null,
      startedAt: input.startedAt ?? now,
      finishedAt: now,
    });

    return {
      syncRunId,
      recordsRead: input.result.rawRecords.length,
      recordsWritten,
    };
  }

  private async updateConnectionSyncState(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
    now: Date,
    firstError: ConnectorSyncResult["errors"][number] | undefined,
  ): Promise<void> {
    const previousFailures = await this.loadConsecutiveFailures(db, input.connectionId);

    let state;
    if (input.result.status === "failed") {
      const isAuthError = firstError?.code === "CONNECTOR_AUTH_ERROR";
      state = {
        syncStatus: isAuthError ? SyncStatus.NEEDS_REAUTH : SyncStatus.ERROR,
        // NEEDS_REAUTH is terminal: leave nextSyncAt untouched so no future
        // retry is scheduled (the scheduler also excludes it by status). Only
        // transient ERRORs get a backoff and are retried.
        ...(isAuthError
          ? {}
          : {
              consecutiveFailures: previousFailures + 1,
              nextSyncAt: new Date(
                now.getTime() + this.failureBackoffMs(input, previousFailures + 1, firstError),
              ),
            }),
        lastSyncErrorCode: firstError?.code ?? null,
        lastSyncErrorMessage: firstError?.message ?? null,
        updatedAt: now,
      };
    } else {
      if (previousFailures >= env.BREAKER_FAILURE_THRESHOLD) {
        this.logger.log({
          event: "breaker.closed",
          providerId: input.result.providerId,
          connectionId: input.connectionId,
          consecutiveFailures: previousFailures,
        });
      }
      state = {
        syncStatus: SyncStatus.OK,
        lastSyncedAt: now,
        nextSyncAt: addMinutes(now, CONNECTOR_SYNC_INTERVAL_MINUTES),
        consecutiveFailures: 0,
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
        updatedAt: now,
      };
    }

    await db
      .update(connectorConnections)
      .set(state)
      .where(eq(connectorConnections.id, input.connectionId));
  }

  /**
   * Backoff before the scheduler may re-select a failed connection.
   *
   * - Rate-limited syncs honour the provider's Retry-After hint (clamped,
   *   jittered) instead of the generic retry interval.
   * - At BREAKER_FAILURE_THRESHOLD consecutive failures the circuit opens:
   *   the connection is parked for at least the breaker cool-down, and the
   *   first sync after it elapses is the half-open probe — success resets
   *   the counter, failure re-opens for another cool-down.
   */
  private failureBackoffMs(
    input: PersistConnectorSyncResultInput,
    consecutiveFailures: number,
    firstError: ConnectorSyncResult["errors"][number] | undefined,
  ): number {
    const isRateLimit = firstError?.code === "CONNECTOR_RATE_LIMIT_ERROR";
    let backoffMs = FAILED_CONNECTOR_RETRY_MINUTES * 60 * 1000;

    if (isRateLimit) {
      const hinted = firstError?.retryAfterMs ?? RATE_LIMIT_DEFAULT_BACKOFF_MS;
      const clamped = Math.min(
        Math.max(hinted, RATE_LIMIT_MIN_BACKOFF_MS),
        RATE_LIMIT_MAX_BACKOFF_MS,
      );
      backoffMs = Math.round(clamped * (1 + Math.random() * BACKOFF_JITTER_RATIO));
      this.logger.warn({
        event: "provider.ratelimit.hit",
        providerId: input.result.providerId,
        connectionId: input.connectionId,
        retryAfterMs: firstError?.retryAfterMs ?? null,
        backoffMs,
      });
    }

    if (consecutiveFailures >= env.BREAKER_FAILURE_THRESHOLD) {
      backoffMs = Math.max(backoffMs, env.BREAKER_COOLDOWN_MS);
      this.logger.warn({
        event: "breaker.opened",
        providerId: input.result.providerId,
        connectionId: input.connectionId,
        consecutiveFailures,
        cooldownMs: backoffMs,
      });
    }

    return backoffMs;
  }

  private async loadConsecutiveFailures(
    db: ConnectorPersistenceDb,
    connectionId: string,
  ): Promise<number> {
    const rows = await db
      .select({ consecutiveFailures: connectorConnections.consecutiveFailures })
      .from(connectorConnections)
      .where(eq(connectorConnections.id, connectionId))
      .limit(1);
    return rows.at(0)?.consecutiveFailures ?? 0;
  }

  private async persistRawRecords(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
  ): Promise<number> {
    if (input.result.rawRecords.length === 0) {
      return 0;
    }

    const inserted = await db
      .insert(rawProviderRecords)
      .values(
        input.result.rawRecords.map((record) => ({
          id: crypto.randomUUID(),
          connectionId: input.connectionId,
          providerId: record.providerId,
          resource: record.resource,
          externalId: record.externalId,
          observedAt: new Date(record.observedAt),
          payload: record.payload,
        })),
      )
      .onConflictDoNothing({
        target: [
          rawProviderRecords.connectionId,
          rawProviderRecords.resource,
          rawProviderRecords.externalId,
          rawProviderRecords.observedAt,
        ],
      })
      .returning({ id: rawProviderRecords.id });

    return inserted.length;
  }

  private async persistAccounts(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
  ): Promise<number> {
    let written = 0;
    const now = new Date();

    for (const account of input.result.accounts) {
      const rows = await db
        .insert(financialAccounts)
        .values({
          id: crypto.randomUUID(),
          connectionId: input.connectionId,
          userId: input.userId,
          providerId: account.providerId,
          externalId: account.externalId,
          type: account.type,
          displayName: account.displayName,
          currency: account.currency,
          metadata: account.metadata,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [financialAccounts.connectionId, financialAccounts.externalId],
          set: {
            type: account.type,
            displayName: account.displayName,
            currency: account.currency,
            metadata: account.metadata,
            updatedAt: now,
          },
        })
        .returning({ id: financialAccounts.id });
      written += rows.length;
    }

    return written;
  }

  private async persistInstruments(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
  ): Promise<number> {
    let written = 0;
    const now = new Date();

    for (const instrument of input.result.instruments) {
      const rows = await db
        .insert(instruments)
        .values({
          id: crypto.randomUUID(),
          providerId: instrument.providerId,
          externalId: instrument.externalId,
          ticker: instrument.ticker,
          name: instrument.name,
          isin: instrument.isin,
          currency: instrument.currency,
          type: instrument.type,
          metadata: instrument.metadata,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [instruments.providerId, instruments.externalId],
          set: {
            ticker: instrument.ticker,
            name: instrument.name,
            isin: instrument.isin,
            currency: instrument.currency,
            type: instrument.type,
            metadata: instrument.metadata,
            updatedAt: now,
          },
        })
        .returning({ id: instruments.id });
      written += rows.length;
    }

    return written;
  }

  private async persistTransactions(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
  ): Promise<number> {
    let written = 0;
    const now = new Date();

    for (const transaction of input.result.transactions) {
      const rows = await db
        .insert(financialTransactions)
        .values({
          id: crypto.randomUUID(),
          connectionId: input.connectionId,
          accountExternalId: transaction.accountExternalId,
          providerId: transaction.providerId,
          externalId: transaction.externalId,
          type: transaction.type,
          status: transaction.status,
          occurredAt: new Date(transaction.occurredAt),
          settledAt: transaction.settledAt ? new Date(transaction.settledAt) : null,
          description: transaction.description,
          amount: transaction.amount,
          currency: transaction.currency,
          instrumentExternalId: transaction.instrumentExternalId,
          quantity: decimalString(transaction.quantity),
          price: decimalString(transaction.price),
          fees: decimalString(transaction.fees),
          tax: decimalString(transaction.tax),
          fxRate: decimalString(transaction.fxRate),
          metadata: transaction.metadata,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [financialTransactions.connectionId, financialTransactions.externalId],
          set: {
            accountExternalId: transaction.accountExternalId,
            type: transaction.type,
            status: transaction.status,
            occurredAt: new Date(transaction.occurredAt),
            settledAt: transaction.settledAt ? new Date(transaction.settledAt) : null,
            description: transaction.description,
            amount: transaction.amount,
            currency: transaction.currency,
            instrumentExternalId: transaction.instrumentExternalId,
            quantity: decimalString(transaction.quantity),
            price: decimalString(transaction.price),
            fees: decimalString(transaction.fees),
            tax: decimalString(transaction.tax),
            fxRate: decimalString(transaction.fxRate),
            metadata: transaction.metadata,
            updatedAt: now,
          },
        })
        .returning({ id: financialTransactions.id });
      written += rows.length;
    }

    return written;
  }

  private async persistHoldings(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
  ): Promise<number> {
    let written = 0;
    const now = new Date();

    for (const holding of input.result.holdings) {
      const rows = await db
        .insert(holdings)
        .values({
          id: crypto.randomUUID(),
          connectionId: input.connectionId,
          accountExternalId: holding.accountExternalId,
          providerId: holding.providerId,
          externalId: holding.externalId,
          instrumentExternalId: holding.instrumentExternalId,
          quantity: holding.quantity.toString(),
          availableQuantity: decimalString(holding.availableQuantity),
          averagePrice: decimalString(holding.averagePrice),
          currentPrice: decimalString(holding.currentPrice),
          currency: holding.currency,
          value: decimalString(holding.value),
          costBasis: decimalString(holding.costBasis),
          unrealizedProfitLoss: decimalString(holding.unrealizedProfitLoss),
          observedAt: new Date(holding.observedAt),
          metadata: holding.metadata,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [holdings.connectionId, holdings.externalId],
          set: {
            accountExternalId: holding.accountExternalId,
            instrumentExternalId: holding.instrumentExternalId,
            quantity: holding.quantity.toString(),
            availableQuantity: decimalString(holding.availableQuantity),
            averagePrice: decimalString(holding.averagePrice),
            currentPrice: decimalString(holding.currentPrice),
            currency: holding.currency,
            value: decimalString(holding.value),
            costBasis: decimalString(holding.costBasis),
            unrealizedProfitLoss: decimalString(holding.unrealizedProfitLoss),
            observedAt: new Date(holding.observedAt),
            metadata: holding.metadata,
            updatedAt: now,
          },
        })
        .returning({ id: holdings.id });
      written += rows.length;
    }

    return written;
  }

  private async persistBalanceSnapshots(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
  ): Promise<number> {
    if (input.result.balanceSnapshots.length === 0) {
      return 0;
    }

    const inserted = await db
      .insert(balanceSnapshots)
      .values(
        input.result.balanceSnapshots.map((snapshot) => ({
          id: crypto.randomUUID(),
          connectionId: input.connectionId,
          accountExternalId: snapshot.accountExternalId,
          providerId: snapshot.providerId,
          currency: snapshot.currency,
          cash: snapshot.cash,
          availableCash: decimalString(snapshot.availableCash),
          blockedCash: decimalString(snapshot.blockedCash),
          invested: decimalString(snapshot.invested),
          total: snapshot.total,
          observedAt: new Date(snapshot.observedAt),
          metadata: snapshot.metadata,
        })),
      )
      .onConflictDoNothing({
        target: [
          balanceSnapshots.connectionId,
          balanceSnapshots.accountExternalId,
          balanceSnapshots.observedAt,
        ],
      })
      .returning({ id: balanceSnapshots.id });

    return inserted.length;
  }

  private async persistPortfolioSnapshots(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
  ): Promise<number> {
    if (input.result.portfolioSnapshots.length === 0) {
      return 0;
    }

    const inserted = await db
      .insert(portfolioSnapshots)
      .values(
        input.result.portfolioSnapshots.map((snapshot) => ({
          id: crypto.randomUUID(),
          connectionId: input.connectionId,
          accountExternalId: snapshot.accountExternalId,
          providerId: snapshot.providerId,
          currency: snapshot.currency,
          cashValue: snapshot.cashValue,
          investmentValue: snapshot.investmentValue,
          totalValue: snapshot.totalValue,
          costBasis: decimalString(snapshot.costBasis),
          realizedProfitLoss: decimalString(snapshot.realizedProfitLoss),
          unrealizedProfitLoss: decimalString(snapshot.unrealizedProfitLoss),
          observedAt: new Date(snapshot.observedAt),
          metadata: snapshot.metadata,
        })),
      )
      .onConflictDoNothing({
        target: [
          portfolioSnapshots.connectionId,
          portfolioSnapshots.accountExternalId,
          portfolioSnapshots.observedAt,
        ],
      })
      .returning({ id: portfolioSnapshots.id });

    return inserted.length;
  }

  private async persistCursors(
    db: ConnectorPersistenceDb,
    input: PersistConnectorSyncResultInput,
    now: Date,
  ): Promise<number> {
    let written = 0;

    for (const cursor of input.result.cursors) {
      const rows = await db
        .insert(connectorSyncCursors)
        .values({
          id: crypto.randomUUID(),
          connectionId: input.connectionId,
          resource: cursor.resource,
          cursor: cursor.cursor,
          checkpoint: cursor.checkpoint,
          metadata: cursor.metadata ?? {},
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [connectorSyncCursors.connectionId, connectorSyncCursors.resource],
          set: {
            cursor: cursor.cursor,
            checkpoint: cursor.checkpoint,
            metadata: cursor.metadata ?? {},
            updatedAt: now,
          },
        })
        .returning({ id: connectorSyncCursors.id });
      written += rows.length;
    }

    return written;
  }
}

// Money fields arrive as canonical decimal strings (see @spark/schema/money);
// quantity fields are still numbers. Either way the numeric column gets the
// value's exact string form.
function decimalString(value: number | string | null | undefined): string | null {
  return value == null ? null : typeof value === "number" ? value.toString() : value;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
