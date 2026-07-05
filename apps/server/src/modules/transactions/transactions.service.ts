import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { TRUELAYER_PROVIDER_ID, truelayerAccountExternalId } from "@spark/connectors";
import { type Database, and, desc, eq, gte, lt, lte, or, sql } from "@spark/db";
import type {
  BalanceSeriesInput,
  BalanceSeriesResponse,
  CurrencyMonthlySummary,
  ListTransactionsInput,
  MonthlySummaryInput,
  MonthlySummaryResponse,
  SavedTransaction,
} from "@spark/schema";
import {
  accountDailyBalances,
  financialAccounts,
  financialTransactions,
  merchants,
  transactionEnrichments,
} from "@spark/db/schema";
import { CategorySource, CategorySourceSchema, SpendingCategory } from "@spark/schema";
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
      // Matches the derived canonical category (built-in value or custom id).
      conditions.push(eq(transactionEnrichments.category, input.category));
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
        enrichedCategory: transactionEnrichments.category,
        enrichedSource: transactionEnrichments.source,
        merchantId: merchants.id,
        merchantDisplayName: merchants.displayName,
      })
      .from(financialTransactions)
      .innerJoin(
        financialAccounts,
        and(
          eq(financialTransactions.connectionId, financialAccounts.connectionId),
          eq(financialTransactions.accountExternalId, financialAccounts.externalId),
        ),
      )
      .leftJoin(
        transactionEnrichments,
        eq(transactionEnrichments.transactionId, financialTransactions.id),
      )
      .leftJoin(merchants, eq(merchants.id, transactionEnrichments.merchantId))
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
   * Monthly income/expense totals and category spend, aggregated in SQL over
   * the month's base rows — exact decimal strings from `numeric` aggregation,
   * and both queries share one scope so totals and categories can never
   * disagree. Category spend joins the enrichment layer, so overrides, rules,
   * and custom categories are reflected. Grouped per currency: cross-currency
   * sums are meaningless without FX, so each currency reports separately and
   * the caller picks which to display.
   *
   * Joins financial_accounts so aggregates cover exactly the accounts the
   * list endpoint shows — a deleted account's history stops counting even
   * though its base rows only disappear when the connection goes.
   */
  async monthlySummary(
    userId: string,
    input: MonthlySummaryInput = {},
  ): Promise<MonthlySummaryResponse> {
    const month = input.month ?? new Date().toISOString().slice(0, 7);
    const monthStart = `${month}-01`;
    const monthEnd = nextMonthStart(month);

    const accountsJoin = and(
      eq(financialTransactions.connectionId, financialAccounts.connectionId),
      eq(financialTransactions.accountExternalId, financialAccounts.externalId),
    );
    // UTC calendar-day bucketing, matching the daily balance series.
    const monthScope = and(
      eq(financialAccounts.userId, userId),
      eq(financialTransactions.providerId, TRUELAYER_PROVIDER_ID),
      sql`(${financialTransactions.occurredAt} AT TIME ZONE 'UTC')::date >= ${monthStart}::date`,
      sql`(${financialTransactions.occurredAt} AT TIME ZONE 'UTC')::date < ${monthEnd}::date`,
    );
    // Amounts are stored unsigned with direction in the transaction type;
    // abs() keeps totals correct for any provider that signs them. A missing
    // type counts as DEBIT.
    const debitTotal = sql`sum(abs(${financialTransactions.amount})) FILTER (
      WHERE coalesce(${financialTransactions.metadata}->>'truelayerTransactionType', 'DEBIT') = 'DEBIT'
    )`;
    const creditTotal = sql`sum(abs(${financialTransactions.amount})) FILTER (
      WHERE ${financialTransactions.metadata}->>'truelayerTransactionType' = 'CREDIT'
    )`;

    const totals = await this.db
      .select({
        currency: financialTransactions.currency,
        income: sql<string>`coalesce(${creditTotal}, 0)::text`,
        expenses: sql<string>`coalesce(${debitTotal}, 0)::text`,
        transactionCount: sql<number>`count(*)::int`,
      })
      .from(financialTransactions)
      .innerJoin(financialAccounts, accountsJoin)
      .where(monthScope)
      .groupBy(financialTransactions.currency)
      .orderBy(desc(sql`count(*)`));

    // A row without an enrichment row (shouldn't happen — enrichment is
    // written with the sync) counts as OTHER rather than vanishing.
    const enrichedCategory = sql<string>`coalesce(${transactionEnrichments.category}, 'OTHER')`;

    const categories = await this.db
      .select({
        currency: financialTransactions.currency,
        category: enrichedCategory,
        total: sql<string>`${debitTotal}::text`,
        transactionCount: sql<number>`count(*)::int`,
      })
      .from(financialTransactions)
      .innerJoin(financialAccounts, accountsJoin)
      .leftJoin(
        transactionEnrichments,
        eq(transactionEnrichments.transactionId, financialTransactions.id),
      )
      .where(monthScope)
      .groupBy(financialTransactions.currency, enrichedCategory)
      .having(sql`${debitTotal} > 0`)
      .orderBy(desc(debitTotal));

    const summaries = new Map<string, CurrencyMonthlySummary>();
    for (const row of totals) {
      summaries.set(row.currency, {
        currency: row.currency as CurrencyMonthlySummary["currency"],
        income: row.income,
        expenses: row.expenses,
        transactionCount: row.transactionCount,
        categories: [],
      });
    }
    for (const row of categories) {
      summaries.get(row.currency)?.categories.push({
        category: row.category,
        total: row.total,
        transactionCount: row.transactionCount,
      });
    }

    return { month, totals: [...summaries.values()] };
  }

  /**
   * Daily balance series over the requested window: at most one point per
   * day regardless of transaction count. Mirrors the original client
   * derivation — per day the most recent end-of-day balance across accounts,
   * carried forward across days that have transactions but no balance.
   */
  async balanceSeries(
    userId: string,
    input: BalanceSeriesInput = {},
  ): Promise<BalanceSeriesResponse> {
    const days = input.days ?? 90;
    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const balances = await this.db
      .selectDistinctOn([accountDailyBalances.day], {
        day: accountDailyBalances.day,
        balance: accountDailyBalances.endOfDayBalance,
        currency: accountDailyBalances.currency,
      })
      .from(accountDailyBalances)
      .innerJoin(
        financialAccounts,
        and(
          eq(accountDailyBalances.connectionId, financialAccounts.connectionId),
          eq(accountDailyBalances.accountExternalId, financialAccounts.externalId),
        ),
      )
      .where(
        and(
          eq(financialAccounts.userId, userId),
          eq(accountDailyBalances.providerId, TRUELAYER_PROVIDER_ID),
          gte(accountDailyBalances.day, since),
        ),
      )
      .orderBy(accountDailyBalances.day, desc(accountDailyBalances.observedAt));

    // Days that had transactions but no observed balance still get a point
    // (carried forward). UTC bucketing matches the balance rows'.
    const transactionDay = sql<string>`((${financialTransactions.occurredAt} AT TIME ZONE 'UTC')::date)::text`;
    const transactionDays = await this.db
      .selectDistinct({ day: transactionDay })
      .from(financialTransactions)
      .innerJoin(
        financialAccounts,
        and(
          eq(financialTransactions.connectionId, financialAccounts.connectionId),
          eq(financialTransactions.accountExternalId, financialAccounts.externalId),
        ),
      )
      .where(
        and(
          eq(financialAccounts.userId, userId),
          eq(financialTransactions.providerId, TRUELAYER_PROVIDER_ID),
          sql`(${financialTransactions.occurredAt} AT TIME ZONE 'UTC')::date >= ${since}::date`,
        ),
      )
      .orderBy(transactionDay);

    const balanceByDay = new Map(balances.map((row) => [row.day, row]));
    const allDays = [
      ...new Set([...balanceByDay.keys(), ...transactionDays.map((r) => r.day)]),
    ].sort();

    const points: BalanceSeriesResponse["points"] = [];
    let lastKnown: { balance: string; currency: string } | undefined;
    for (const day of allDays) {
      const observed = balanceByDay.get(day);
      if (observed) {
        lastKnown = { balance: observed.balance, currency: observed.currency };
      }
      if (lastKnown) {
        points.push({
          date: day,
          balance: lastKnown.balance,
          currency: lastKnown.currency as BalanceSeriesResponse["points"][number]["currency"],
        });
      }
    }

    return { points };
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
    enrichedCategory: string | null;
    enrichedSource: string | null;
    merchantId: string | null;
    merchantDisplayName: string | null;
  }): SavedTransaction {
    const metadata = row.metadata;
    // Enrichment is written in the same unit of work as the base row, so
    // it's present for every synced transaction; the OTHER fallback only
    // guards a missing row from ever breaking the API shape. Stored
    // categories are opaque references (built-in value or custom category
    // id), validated at write time.
    const category = row.enrichedCategory ?? SpendingCategory.OTHER;
    const source = CategorySourceSchema.safeParse(row.enrichedSource);
    const categorySource = source.success ? source.data : CategorySource.PROVIDER_DEFAULT;

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
      category,
      categorySource,
      merchant:
        row.merchantId && row.merchantDisplayName
          ? { id: row.merchantId, displayName: row.merchantDisplayName }
          : null,
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

/** First day of the month after a YYYY-MM month, as YYYY-MM-DD. */
function nextMonthStart(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return next.toISOString().slice(0, 10);
}
