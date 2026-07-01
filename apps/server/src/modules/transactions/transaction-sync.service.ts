import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, sql } from "@spark/db";
import { truelayerTransactions } from "@spark/db/schema";
import { SyncStatus } from "@spark/common";
import type { AccountType } from "@spark/schema";
import {
  TruelayerClient,
  TruelayerConnectionService,
  TruelayerAccountStatusService,
  syncStatusFromError,
} from "../../providers/truelayer";
import { DATABASE_CONNECTION } from "../database";

const DEFAULT_SYNC_DAYS = 7;
const MAX_SYNC_DAYS = 90;
// Transient ERRORs are retried by the scheduler after this backoff.
const ERROR_RETRY_MINUTES = 30;

interface BaseSyncParams {
  accountId: string;
  connectionId: string;
  accountType?: AccountType | null;
}

interface InitialSyncParams extends BaseSyncParams {
  daysToSync: number;
}

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
    private readonly statusService: TruelayerAccountStatusService,
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
        accountType: params.accountType,
        from: formatDate(fromDate),
        to: formatDate(toDate),
      });

      this.logger.log(`Fetched ${transactions.length} transactions for account ${accountId}`);

      if (transactions.length === 0) {
        await this.statusService.update(accountId, SyncStatus.OK, { lastSyncedAt: new Date() });
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
        amount: transaction.amount,
        currency: transaction.currency,
        transactionType: transaction.transactionType,
        transactionCategory: transaction.transactionCategory,
        transactionClassification: transaction.transactionClassification,
        merchantName: transaction.merchantName ?? null,
        runningBalance: transaction.runningBalance ?? null,
        meta: transaction.meta ?? null,
      }));

      const now = new Date();
      // Transactions can change upstream, so refresh mutable fields on conflict.
      const affected = await this.db
        .insert(truelayerTransactions)
        .values(transactionValues)
        .onConflictDoUpdate({
          target: [truelayerTransactions.transactionId, truelayerTransactions.accountId],
          set: {
            normalisedProviderTransactionId: sql`excluded.normalised_provider_transaction_id`,
            providerTransactionId: sql`excluded.provider_transaction_id`,
            timestamp: sql`excluded.timestamp`,
            description: sql`excluded.description`,
            amount: sql`excluded.amount`,
            currency: sql`excluded.currency`,
            transactionType: sql`excluded.transaction_type`,
            transactionCategory: sql`excluded.transaction_category`,
            transactionClassification: sql`excluded.transaction_classification`,
            merchantName: sql`excluded.merchant_name`,
            runningBalance: sql`excluded.running_balance`,
            meta: sql`excluded.meta`,
            updatedAt: now,
          },
        })
        .returning({ id: truelayerTransactions.id });

      await this.statusService.update(accountId, SyncStatus.OK, { lastSyncedAt: now });

      this.logger.log(`Upserted ${affected.length} transactions for account ${accountId}`);

      return affected.length;
    } catch (error) {
      this.logger.error(
        `Failed to sync transactions for account ${accountId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // NEEDS_REAUTH is terminal — no backoff is written so the scheduler stops
      // re-queuing the account. Transient ERRORs retry after the backoff.
      const status = syncStatusFromError(error);
      const nextSyncAt =
        status === SyncStatus.ERROR
          ? new Date(Date.now() + ERROR_RETRY_MINUTES * 60 * 1000)
          : undefined;
      await this.statusService.update(accountId, status, { nextSyncAt });
      throw error;
    }
  }

  private calculateFromDate(toDate: Date, params: SyncTransactionsParams): Date {
    if ("daysToSync" in params) {
      const fromDate = new Date(toDate);
      fromDate.setDate(fromDate.getDate() - params.daysToSync);
      return fromDate;
    }

    const { lastSyncedAt } = params;

    const defaultFromDate = new Date(toDate);
    defaultFromDate.setDate(defaultFromDate.getDate() - DEFAULT_SYNC_DAYS);

    const maxFromDate = new Date(toDate);
    maxFromDate.setDate(maxFromDate.getDate() - MAX_SYNC_DAYS);

    if (!lastSyncedAt) {
      return defaultFromDate;
    }

    if (lastSyncedAt < maxFromDate) {
      this.logger.warn(
        `lastSyncedAt (${lastSyncedAt.toISOString()}) exceeds max lookback of ${MAX_SYNC_DAYS} days, capping to ${maxFromDate.toISOString()}`,
      );
      return maxFromDate;
    }

    if (lastSyncedAt >= defaultFromDate) {
      return defaultFromDate;
    }

    const fromDate = new Date(lastSyncedAt);
    fromDate.setDate(fromDate.getDate() - 1);
    return fromDate;
  }
}
