import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, eq } from "@spark/db";
import { truelayerConnections, truelayerTransactions } from "@spark/db/schema";
import { TruelayerClient } from "../../providers/truelayer/truelayer.client";
import { DATABASE_CONNECTION } from "../../modules/database";
import { ConnectionNotFoundError, TokenExpiredError, TokenRefreshError } from "../errors";

export interface SyncTransactionsParams {
  accountId: string;
  connectionId: string;
  daysToSync: number;
}

@Injectable()
export class TransactionSyncService {
  private readonly logger = new Logger(TransactionSyncService.name);

  constructor(
    private readonly truelayerClient: TruelayerClient,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  async syncTransactions(params: SyncTransactionsParams): Promise<number> {
    const { accountId, connectionId, daysToSync } = params;

    const connection = await this.db.query.truelayerConnections.findFirst({
      where: eq(truelayerConnections.id, connectionId),
    });

    if (!connection) {
      throw new ConnectionNotFoundError(connectionId);
    }

    const accessToken = await this.getValidAccessToken(connection);

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysToSync);

    const formatDate = (date: Date): string => date.toISOString().split("T")[0];

    this.logger.log(
      `Fetching transactions from ${formatDate(fromDate)} to ${formatDate(toDate)} for account ${accountId}`,
    );

    let transactions;
    try {
      transactions = await this.truelayerClient.getTransactions({
        accessToken,
        accountId,
        from: formatDate(fromDate),
        to: formatDate(toDate),
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch transactions for account ${accountId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }

    this.logger.log(`Fetched ${transactions.length} transactions for account ${accountId}`);

    if (transactions.length === 0) {
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

    await this.db
      .insert(truelayerTransactions)
      .values(transactionValues)
      .onConflictDoNothing({
        target: [truelayerTransactions.transactionId, truelayerTransactions.accountId],
      });

    this.logger.log(`Saved ${transactions.length} transactions for account ${accountId}`);

    return transactions.length;
  }

  private async getValidAccessToken(
    connection: typeof truelayerConnections.$inferSelect,
  ): Promise<string> {
    if (connection.expiresAt >= new Date()) {
      return connection.accessToken;
    }

    if (!connection.refreshToken) {
      throw new TokenExpiredError(connection.id);
    }

    this.logger.log(`Refreshing token for connection ${connection.id}`);

    let tokenResponse;
    try {
      tokenResponse = await this.truelayerClient.refreshToken({
        refreshToken: connection.refreshToken,
      });
    } catch (error) {
      throw new TokenRefreshError(connection.id, error instanceof Error ? error : undefined);
    }

    await this.db
      .update(truelayerConnections)
      .set({
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt: tokenResponse.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(truelayerConnections.id, connection.id));

    return tokenResponse.accessToken;
  }
}
