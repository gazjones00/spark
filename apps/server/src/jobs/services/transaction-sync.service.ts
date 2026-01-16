// TODO: Move to transactions module once it's implemented

import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, eq } from "@spark/db";
import { SyncStatus, truelayerAccounts, truelayerTransactions } from "@spark/db/schema";
import {
  TruelayerClient,
  TruelayerConnectionService,
  TokenExpiredError,
} from "../../providers/truelayer";
import { DATABASE_CONNECTION } from "../../modules/database";

const DEFAULT_SYNC_DAYS = 7;
const MAX_SYNC_DAYS = 90;

interface BaseSyncParams {
  accountId: string;
  connectionId: string;
}

/** For initial sync - explicitly sync this many days back */
interface InitialSyncParams extends BaseSyncParams {
  daysToSync: number;
}

/** For periodic sync - sync from last known sync date */
interface PeriodicSyncParams extends BaseSyncParams {
  lastSyncedAt: Date | null;
}

export type SyncTransactionsParams = InitialSyncParams | PeriodicSyncParams;

@Injectable()
export class TransactionSyncService {
  private readonly logger = new Logger(TransactionSyncService.name);

  constructor(
    private readonly truelayerClient: TruelayerClient,
    private readonly connectionService: TruelayerConnectionService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  async syncTransactions(params: SyncTransactionsParams): Promise<number> {
    const { accountId, connectionId } = params;

    try {
      const accessToken = await this.connectionService.getAccessToken(connectionId);

      const toDate = new Date();
      const fromDate = this.calculateFromDate(toDate, params);
      const formatDate = (date: Date): string => date.toISOString().split("T")[0];

      this.logger.log(
        `Fetching transactions from ${formatDate(fromDate)} to ${formatDate(toDate)} for account ${accountId}`,
      );

      const transactions = await this.truelayerClient.getTransactions({
        accessToken,
        accountId,
        from: formatDate(fromDate),
        to: formatDate(toDate),
      });

      this.logger.log(`Fetched ${transactions.length} transactions for account ${accountId}`);

      if (transactions.length === 0) {
        await this.updateSyncStatus(accountId, SyncStatus.OK, new Date());
        return 0;
      }

      const transactionValues = transactions.map((transaction) => ({
        id: crypto.randomUUID(),
        transactionId: transaction.transactionId,
        accountId,
        normalisedProviderTransactionId: transaction.normalisedProviderTransactionId ?? null,
        providerTransactionId: transaction.providerTransactionId ?? null,
        timestamp: new Date(transaction.timestamp),
        description: transaction.description,
        amount: transaction.amount.toString(),
        currency: transaction.currency,
        transactionType: transaction.transactionType,
        transactionCategory: transaction.transactionCategory,
        transactionClassification: transaction.transactionClassification,
        merchantName: transaction.merchantName ?? null,
        runningBalance: transaction.runningBalance ?? null,
        meta: transaction.meta ?? null,
      }));

      const inserted = await this.db
        .insert(truelayerTransactions)
        .values(transactionValues)
        .onConflictDoNothing({
          target: [truelayerTransactions.transactionId, truelayerTransactions.accountId],
        })
        .returning({ id: truelayerTransactions.id });

      const now = new Date();
      await this.updateSyncStatus(accountId, SyncStatus.OK, now);

      if (inserted.length > 0) {
        this.logger.log(`Inserted ${inserted.length} new transactions for account ${accountId}`);
      } else {
        this.logger.log(`No new transactions for account ${accountId}`);
      }

      return inserted.length;
    } catch (error) {
      this.logger.error(
        `Failed to sync transactions for account ${accountId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      const status =
        error instanceof TokenExpiredError ? SyncStatus.NEEDS_REAUTH : SyncStatus.ERROR;
      await this.updateSyncStatus(accountId, status);
      throw error;
    }
  }

  private async updateSyncStatus(
    accountId: string,
    status: SyncStatus,
    lastSyncedAt?: Date,
  ): Promise<void> {
    const now = new Date();
    await this.db
      .update(truelayerAccounts)
      .set({
        syncStatus: status,
        updatedAt: now,
        ...(lastSyncedAt && { lastSyncedAt }),
      })
      .where(eq(truelayerAccounts.accountId, accountId));
  }

  private calculateFromDate(toDate: Date, params: SyncTransactionsParams): Date {
    // Initial sync - use explicit daysToSync
    if ("daysToSync" in params) {
      const fromDate = new Date(toDate);
      fromDate.setDate(fromDate.getDate() - params.daysToSync);
      return fromDate;
    }

    // Periodic sync - use lastSyncedAt
    const { lastSyncedAt } = params;

    const defaultFromDate = new Date(toDate);
    defaultFromDate.setDate(defaultFromDate.getDate() - DEFAULT_SYNC_DAYS);

    const maxFromDate = new Date(toDate);
    maxFromDate.setDate(maxFromDate.getDate() - MAX_SYNC_DAYS);

    if (!lastSyncedAt) {
      return defaultFromDate;
    }

    // If lastSyncedAt is older than max lookback, cap it
    if (lastSyncedAt < maxFromDate) {
      this.logger.warn(
        `lastSyncedAt (${lastSyncedAt.toISOString()}) exceeds max lookback of ${MAX_SYNC_DAYS} days, capping to ${maxFromDate.toISOString()}`,
      );
      return maxFromDate;
    }

    // If lastSyncedAt is within the default range, use default
    if (lastSyncedAt >= defaultFromDate) {
      return defaultFromDate;
    }

    // Use lastSyncedAt as the from date (with a 1-day overlap for safety)
    const fromDate = new Date(lastSyncedAt);
    fromDate.setDate(fromDate.getDate() - 1);
    return fromDate;
  }
}
