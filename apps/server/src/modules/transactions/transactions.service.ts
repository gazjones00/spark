import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { type Database, and, desc, eq, gte, lt, lte, or, sql } from "@spark/db";
import type { ListTransactionsInput } from "@spark/schema";
import { truelayerAccounts, truelayerTransactions } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../database";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface CursorPayload {
  timestamp: string;
  id: string;
}

@Injectable()
export class TransactionsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async list(userId: string, input: ListTransactionsInput = {}) {
    const limit = this.getLimit(input.limit);
    const conditions = [eq(truelayerAccounts.userId, userId)];

    if (input.accountId) {
      conditions.push(eq(truelayerTransactions.accountId, input.accountId));
    }

    if (input.category) {
      conditions.push(eq(truelayerTransactions.transactionCategory, input.category));
    }

    if (input.search) {
      const searchPattern = `%${input.search.toLowerCase()}%`;
      conditions.push(
        sql`(
          lower(${truelayerTransactions.description}) like ${searchPattern}
          or lower(coalesce(${truelayerTransactions.merchantName}, '')) like ${searchPattern}
        )`,
      );
    }

    const fromDate = input.from ? this.parseDate(input.from, "from") : null;
    const toDate = input.to ? this.parseDate(input.to, "to") : null;
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException("'from' must be before or equal to 'to'");
    }

    if (fromDate) {
      conditions.push(gte(truelayerTransactions.timestamp, fromDate));
    }

    if (toDate) {
      conditions.push(lte(truelayerTransactions.timestamp, toDate));
    }

    const cursor = input.cursor ? this.decodeCursor(input.cursor) : null;
    if (cursor) {
      conditions.push(
        or(
          lt(truelayerTransactions.timestamp, cursor.timestamp),
          and(
            eq(truelayerTransactions.timestamp, cursor.timestamp),
            lt(truelayerTransactions.id, cursor.id),
          ),
        )!,
      );
    }

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
      .where(and(...conditions))
      .orderBy(desc(truelayerTransactions.timestamp), desc(truelayerTransactions.id))
      .limit(limit + 1);

    const hasMore = transactions.length > limit;
    const currentPageTransactions = hasMore ? transactions.slice(0, limit) : transactions;
    const lastTransaction = currentPageTransactions.at(-1);
    const nextCursor = hasMore && lastTransaction ? this.encodeCursor(lastTransaction) : null;

    return {
      transactions: currentPageTransactions.map((transaction) => ({
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
      nextCursor,
      hasMore,
    };
  }

  private getLimit(limit?: number): number {
    if (!limit) {
      return DEFAULT_LIMIT;
    }

    return Math.min(Math.max(limit, 1), MAX_LIMIT);
  }

  private parseDate(value: string, field: "from" | "to"): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid '${field}' date`);
    }
    return date;
  }

  private encodeCursor(transaction: { timestamp: Date; id: string }): string {
    const payload: CursorPayload = {
      timestamp: transaction.timestamp.toISOString(),
      id: transaction.id,
    };

    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  }

  private decodeCursor(cursor: string): { timestamp: Date; id: string } {
    let payload: CursorPayload;

    try {
      payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
    } catch {
      throw new BadRequestException("Invalid cursor");
    }

    if (!payload?.timestamp || !payload?.id) {
      throw new BadRequestException("Invalid cursor");
    }

    const timestamp = new Date(payload.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      throw new BadRequestException("Invalid cursor");
    }

    return { timestamp, id: payload.id };
  }
}
