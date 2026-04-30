import { Inject, Injectable } from "@nestjs/common";
import type { ConnectorSyncResult } from "@spark/connectors";
import { SyncStatus } from "@spark/common";
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

const CONNECTOR_SYNC_INTERVAL_MINUTES = 5;
const FAILED_CONNECTOR_RETRY_MINUTES = 30;

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
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

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
    firstError: { code: string; message: string } | undefined,
  ): Promise<void> {
    const nextSyncAt =
      input.result.status === "failed"
        ? addMinutes(now, FAILED_CONNECTOR_RETRY_MINUTES)
        : addMinutes(now, CONNECTOR_SYNC_INTERVAL_MINUTES);
    const state =
      input.result.status === "failed"
        ? {
            syncStatus:
              firstError?.code === "CONNECTOR_AUTH_ERROR"
                ? SyncStatus.NEEDS_REAUTH
                : SyncStatus.ERROR,
            nextSyncAt,
            lastSyncErrorCode: firstError?.code ?? null,
            lastSyncErrorMessage: firstError?.message ?? null,
            updatedAt: now,
          }
        : {
            syncStatus: SyncStatus.OK,
            lastSyncedAt: now,
            nextSyncAt,
            lastSyncErrorCode: null,
            lastSyncErrorMessage: null,
            updatedAt: now,
          };

    await db
      .update(connectorConnections)
      .set(state)
      .where(eq(connectorConnections.id, input.connectionId));
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
          amount: transaction.amount.toString(),
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
            amount: transaction.amount.toString(),
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
          cash: snapshot.cash.toString(),
          availableCash: decimalString(snapshot.availableCash),
          blockedCash: decimalString(snapshot.blockedCash),
          invested: decimalString(snapshot.invested),
          total: snapshot.total.toString(),
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
          cashValue: snapshot.cashValue.toString(),
          investmentValue: snapshot.investmentValue.toString(),
          totalValue: snapshot.totalValue.toString(),
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

function decimalString(value: number | null): string | null {
  return value === null ? null : value.toString();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
