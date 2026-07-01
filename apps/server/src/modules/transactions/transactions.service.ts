import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { TRUELAYER_PROVIDER_ID, truelayerAccountExternalId } from "@spark/connectors";
import { type Database, and, desc, eq, gte, lt, lte, or, sql } from "@spark/db";
import type { ListTransactionsInput, SavedTransaction } from "@spark/schema";
import { financialAccounts, financialTransactions } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../database";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface CursorPayload {
  timestamp: string;
  id: string;
}

/**
 * Banking transaction reads, served from the canonical connector tables
 * (financial_transactions; banking detail from row metadata written by the
 * TrueLayer connector mappers) — see docs/adr/0001. The API contract shape
 * (SavedTransaction) is unchanged.
 */
@Injectable()
export class TransactionsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async list(userId: string, input: ListTransactionsInput = {}) {
    const limit = this.getLimit(input.limit);
    const conditions = [
      eq(financialAccounts.userId, userId),
      eq(financialTransactions.providerId, TRUELAYER_PROVIDER_ID),
    ];

    if (input.accountId) {
      conditions.push(
        eq(financialTransactions.accountExternalId, truelayerAccountExternalId(input.accountId)),
      );
    }

    if (input.category) {
      conditions.push(
        sql`${financialTransactions.metadata}->>'transactionCategory' = ${input.category}`,
      );
    }

    if (input.search) {
      const searchPattern = `%${input.search.toLowerCase()}%`;
      conditions.push(
        sql`(
          lower(${financialTransactions.description}) like ${searchPattern}
          or lower(coalesce(${financialTransactions.metadata}->>'merchantName', '')) like ${searchPattern}
        )`,
      );
    }

    const fromDate = input.from ? this.parseDate(input.from, "from") : null;
    const toDate = input.to ? this.parseDate(input.to, "to") : null;
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException("'from' must be before or equal to 'to'");
    }

    if (fromDate) {
      conditions.push(gte(financialTransactions.occurredAt, fromDate));
    }

    if (toDate) {
      conditions.push(lte(financialTransactions.occurredAt, toDate));
    }

    const cursor = input.cursor ? this.decodeCursor(input.cursor) : null;
    if (cursor) {
      conditions.push(
        or(
          lt(financialTransactions.occurredAt, cursor.timestamp),
          and(
            eq(financialTransactions.occurredAt, cursor.timestamp),
            lt(financialTransactions.id, cursor.id),
          ),
        )!,
      );
    }

    const rows = await this.db
      .select({
        id: financialTransactions.id,
        externalId: financialTransactions.externalId,
        accountExternalId: financialTransactions.accountExternalId,
        occurredAt: financialTransactions.occurredAt,
        description: financialTransactions.description,
        amount: financialTransactions.amount,
        currency: financialTransactions.currency,
        metadata: financialTransactions.metadata,
        updatedAt: financialTransactions.updatedAt,
      })
      .from(financialTransactions)
      .innerJoin(
        financialAccounts,
        and(
          eq(financialTransactions.connectionId, financialAccounts.connectionId),
          eq(financialTransactions.accountExternalId, financialAccounts.externalId),
        ),
      )
      .where(and(...conditions))
      .orderBy(desc(financialTransactions.occurredAt), desc(financialTransactions.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const currentPage = hasMore ? rows.slice(0, limit) : rows;
    const lastTransaction = currentPage.at(-1);
    const nextCursor =
      hasMore && lastTransaction
        ? this.encodeCursor({ timestamp: lastTransaction.occurredAt, id: lastTransaction.id })
        : null;

    return {
      transactions: currentPage.map((row) => this.toSavedTransaction(row)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Rebuilds the TrueLayer-shaped SavedTransaction from the canonical row:
   * banking fields ride in metadata (see mapTrueLayerTransaction).
   */
  private toSavedTransaction(row: {
    id: string;
    externalId: string;
    accountExternalId: string;
    occurredAt: Date;
    description: string;
    amount: string;
    currency: string;
    metadata: Record<string, unknown>;
    updatedAt: Date;
  }): SavedTransaction {
    const metadata = row.metadata;
    return {
      id: row.id,
      transactionId:
        typeof metadata.truelayerTransactionId === "string"
          ? metadata.truelayerTransactionId
          : row.externalId.replace("truelayer:txn:", ""),
      accountId: row.accountExternalId.replace("truelayer:account:", ""),
      normalisedProviderTransactionId:
        (metadata.normalisedProviderTransactionId as string | null | undefined) ?? null,
      providerTransactionId: (metadata.providerTransactionId as string | null | undefined) ?? null,
      timestamp: row.occurredAt.toISOString(),
      description: row.description,
      amount: row.amount,
      currency: row.currency as SavedTransaction["currency"],
      transactionType:
        (metadata.truelayerTransactionType as SavedTransaction["transactionType"]) ?? "DEBIT",
      transactionCategory:
        (metadata.transactionCategory as SavedTransaction["transactionCategory"]) ?? "UNKNOWN",
      transactionClassification: Array.isArray(metadata.transactionClassification)
        ? (metadata.transactionClassification as string[])
        : [],
      merchantName: (metadata.merchantName as string | null | undefined) ?? null,
      runningBalance:
        (metadata.runningBalance as SavedTransaction["runningBalance"] | undefined) ?? null,
      meta: (metadata.meta as SavedTransaction["meta"] | undefined) ?? null,
      updatedAt: row.updatedAt.toISOString(),
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
