import { Inject, Injectable } from "@nestjs/common";
import { type Database, desc, eq } from "@spark/db";
import { truelayerAccounts, truelayerTransactions } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../database";

const MAX_TRANSACTIONS = 1000;

@Injectable()
export class TransactionsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async list(userId: string) {
    const transactions = await this.db
      .select({
        id: truelayerTransactions.id,
        transactionId: truelayerTransactions.transactionId,
        accountId: truelayerTransactions.accountId,
        normalisedProviderTransactionId: truelayerTransactions.normalisedProviderTransactionId,
        providerTransactionId: truelayerTransactions.providerTransactionId,
        timestamp: truelayerTransactions.timestamp,
        description: truelayerTransactions.description,
        amount: truelayerTransactions.amount,
        currency: truelayerTransactions.currency,
        transactionType: truelayerTransactions.transactionType,
        transactionCategory: truelayerTransactions.transactionCategory,
        transactionClassification: truelayerTransactions.transactionClassification,
        merchantName: truelayerTransactions.merchantName,
        runningBalance: truelayerTransactions.runningBalance,
        meta: truelayerTransactions.meta,
        updatedAt: truelayerTransactions.updatedAt,
      })
      .from(truelayerTransactions)
      .innerJoin(
        truelayerAccounts,
        eq(truelayerTransactions.accountId, truelayerAccounts.accountId),
      )
      .where(eq(truelayerAccounts.userId, userId))
      .orderBy(desc(truelayerTransactions.timestamp), desc(truelayerTransactions.updatedAt))
      .limit(MAX_TRANSACTIONS);

    return {
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        transactionId: transaction.transactionId,
        accountId: transaction.accountId,
        normalisedProviderTransactionId: transaction.normalisedProviderTransactionId,
        providerTransactionId: transaction.providerTransactionId,
        timestamp: transaction.timestamp.toISOString(),
        description: transaction.description,
        amount: transaction.amount,
        currency: transaction.currency,
        transactionType: transaction.transactionType,
        transactionCategory: transaction.transactionCategory,
        transactionClassification: transaction.transactionClassification,
        merchantName: transaction.merchantName,
        runningBalance: transaction.runningBalance,
        meta: transaction.meta,
        updatedAt: transaction.updatedAt.toISOString(),
      })),
    };
  }
}
