import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, eq } from "@spark/db";
import { truelayerConnections, truelayerTransactions } from "@spark/db/schema";
import { TruelayerClient } from "../../providers/truelayer/truelayer.client";
import { DATABASE_CONNECTION } from "../../modules/database";
import { MessageQueue, Process, Processor } from "../../modules/message-queue";

export interface InitialSyncJobData {
  accountId: string;
  connectionId: string;
}

const HISTORICAL_DAYS = 90;

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class InitialSyncJob {
  private readonly logger = new Logger(InitialSyncJob.name);

  constructor(
    private readonly truelayerClient: TruelayerClient,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  @Process("InitialSyncJob")
  async handle(data: InitialSyncJobData): Promise<void> {
    const { accountId, connectionId } = data;

    this.logger.log(`Starting initial sync for account ${accountId}`);

    const connection = await this.db.query.truelayerConnections.findFirst({
      where: eq(truelayerConnections.id, connectionId),
    });

    if (!connection) {
      this.logger.error(`Connection ${connectionId} not found`);
      return;
    }

    let accessToken = connection.accessToken;

    if (connection.expiresAt < new Date()) {
      if (!connection.refreshToken) {
        this.logger.error(`Connection ${connectionId} expired and no refresh token available`);
        return;
      }

      this.logger.log(`Access token expired, refreshing for connection ${connectionId}`);
      const tokenResponse = await this.truelayerClient.refreshToken({
        refreshToken: connection.refreshToken,
      });

      accessToken = tokenResponse.accessToken;

      await this.db
        .update(truelayerConnections)
        .set({
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          expiresAt: tokenResponse.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(truelayerConnections.id, connectionId));
    }

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - HISTORICAL_DAYS);

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
      this.logger.log(`No transactions to sync for account ${accountId}`);
      return;
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
      .onConflictDoNothing({ target: [truelayerTransactions.transactionId, truelayerTransactions.accountId] });

    this.logger.log(`Saved ${transactions.length} transactions for account ${accountId}`);
  }
}
