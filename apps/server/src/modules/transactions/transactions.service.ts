import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { TRUELAYER_PROVIDER_ID, truelayerAccountExternalId } from "@spark/connectors";
import { type Database, alias, and, desc, eq, gt, gte, lt, lte, or, sql } from "@spark/db";
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
  balanceSnapshots,
  financialAccounts,
  financialTransactions,
  merchants,
  transactionEnrichments,
} from "@spark/db/schema";
import {
  CategorySource,
  CategorySourceSchema,
  FinancialAccountType,
  SpendingCategory,
} from "@spark/schema";
import { DATABASE_CONNECTION } from "../database";
import { movementsFrom, reconstructBalanceSeries, type SeriesAccount } from "./balance-series";

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
    // UTC calendar-day bucketing, matching the daily balance series. Money
    // moved between the user's own accounts is neither income nor spending.
    const monthScope = and(
      eq(financialAccounts.userId, userId),
      eq(financialTransactions.providerId, TRUELAYER_PROVIDER_ID),
      sql`(${financialTransactions.occurredAt} AT TIME ZONE 'UTC')::date >= ${monthStart}::date`,
      sql`(${financialTransactions.occurredAt} AT TIME ZONE 'UTC')::date < ${monthEnd}::date`,
      sql`not ${isInternalTransfer()}`,
    );
    // Amounts are stored unsigned with direction in the transaction type;
    // abs() keeps totals correct for any provider that signs them. A missing
    // type counts as DEBIT.
    const isDebit = sql`coalesce(${financialTransactions.metadata}->>'truelayerTransactionType', 'DEBIT') = 'DEBIT'`;
    const debitTotal = sql`sum(abs(${financialTransactions.amount})) FILTER (WHERE ${isDebit})`;
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
        // Count matches the total's scope: spend rows only, credits excluded.
        transactionCount: sql<number>`(count(*) FILTER (WHERE ${isDebit}))::int`,
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
   * Net worth per UTC day over the window, every account included: each one
   * is rebuilt from its latest balance snapshot and its transactions (see
   * reconstructBalanceSeries), so accounts whose provider sends no running
   * balance still count, and cards count as debt.
   */
  async balanceSeries(
    userId: string,
    input: BalanceSeriesInput = {},
  ): Promise<BalanceSeriesResponse> {
    const days = input.days ?? 90;
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const anchors = await this.db
      .selectDistinctOn([balanceSnapshots.connectionId, balanceSnapshots.accountExternalId], {
        connectionId: balanceSnapshots.connectionId,
        accountExternalId: balanceSnapshots.accountExternalId,
        balance: balanceSnapshots.cash,
        observedAt: balanceSnapshots.observedAt,
        observedDay: sql<string>`((${balanceSnapshots.observedAt} AT TIME ZONE 'UTC')::date)::text`,
        type: financialAccounts.type,
        currency: financialAccounts.currency,
      })
      .from(balanceSnapshots)
      .innerJoin(
        financialAccounts,
        and(
          eq(balanceSnapshots.connectionId, financialAccounts.connectionId),
          eq(balanceSnapshots.accountExternalId, financialAccounts.externalId),
        ),
      )
      .where(
        and(
          eq(financialAccounts.userId, userId),
          eq(financialAccounts.providerId, TRUELAYER_PROVIDER_ID),
        ),
      )
      .orderBy(
        balanceSnapshots.connectionId,
        balanceSnapshots.accountExternalId,
        desc(balanceSnapshots.observedAt),
      );

    if (anchors.length === 0) {
      return { points: [] };
    }
    const accounts: SeriesAccount[] = anchors.map((row) => ({
      key: seriesKey(row.connectionId, row.accountExternalId),
      type: row.type,
      currency: row.currency,
      anchorBalance: row.balance,
      anchorDay: row.observedDay,
    }));

    const transactionDay = sql<string>`((${financialTransactions.occurredAt} AT TIME ZONE 'UTC')::date)::text`;
    const movementRows = await this.db
      .select({
        connectionId: financialTransactions.connectionId,
        accountExternalId: financialTransactions.accountExternalId,
        day: transactionDay,
        amount: sql<string>`sum(${financialTransactions.amount})::text`,
      })
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
          sql`(${financialTransactions.occurredAt} AT TIME ZONE 'UTC')::date >= ${movementsFrom(accounts, from)}::date`,
        ),
      )
      .groupBy(
        financialTransactions.connectionId,
        financialTransactions.accountExternalId,
        transactionDay,
      );

    // A snapshot taken mid-day doesn't include that day's later transactions.
    const laterOnAnchorDay = await this.db
      .select({
        connectionId: financialTransactions.connectionId,
        accountExternalId: financialTransactions.accountExternalId,
        amount: sql<string>`sum(${financialTransactions.amount})::text`,
      })
      .from(financialTransactions)
      .where(
        or(
          ...anchors.map((anchor) =>
            and(
              eq(financialTransactions.connectionId, anchor.connectionId),
              eq(financialTransactions.accountExternalId, anchor.accountExternalId),
              gt(financialTransactions.occurredAt, anchor.observedAt),
              sql`(${financialTransactions.occurredAt} AT TIME ZONE 'UTC')::date = ${anchor.observedDay}::date`,
            ),
          ),
        ),
      )
      .groupBy(financialTransactions.connectionId, financialTransactions.accountExternalId);
    const laterByKey = new Map(
      laterOnAnchorDay.map((row) => [
        seriesKey(row.connectionId, row.accountExternalId),
        row.amount,
      ]),
    );
    for (const account of accounts) {
      account.movedLaterOnAnchorDay = laterByKey.get(account.key);
    }

    const points = reconstructBalanceSeries(
      accounts,
      movementRows.map((row) => ({
        key: seriesKey(row.connectionId, row.accountExternalId),
        day: row.day,
        amount: row.amount,
      })),
      { from, to },
    );
    return { points: points as BalanceSeriesResponse["points"] };
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

/**
 * Whether the outer financial_transactions row is one leg of a transfer
 * between two of the same user's accounts: another account of theirs has the
 * same amount moving the other way within three days. Card payments (a debit
 * from the current account, a credit on the card) and savings moves would
 * otherwise count twice, as spending on one side and income on the other.
 *
 * Equal opposite amounts happen by coincidence too, so one leg must be on a
 * card or carry the provider's TRANSFER category; a £20 bought and a £20 paid
 * back by a friend on another account stay counted.
 */
function isInternalTransfer() {
  const counterpartName = "transfer_counterpart";
  const counterpartAccountName = "transfer_counterpart_account";
  const counterpart = alias(financialTransactions, counterpartName);
  const counterpartAccount = alias(financialAccounts, counterpartAccountName);
  const direction = (table: typeof financialTransactions | typeof counterpart) =>
    sql`coalesce(${table.metadata}->>'truelayerTransactionType', 'DEBIT')`;
  // An alias interpolated into raw SQL renders as its bare name, so the FROM
  // clause names each table and its alias explicitly.
  return sql`exists (select 1 from ${financialTransactions} ${sql.identifier(counterpartName)}
      inner join ${financialAccounts} ${sql.identifier(counterpartAccountName)}
        on ${counterpartAccount.connectionId} = ${counterpart.connectionId}
        and ${counterpartAccount.externalId} = ${counterpart.accountExternalId}
      where ${counterpartAccount.userId} = ${financialAccounts.userId}
        and not (${counterpart.connectionId} = ${financialTransactions.connectionId}
          and ${counterpart.accountExternalId} = ${financialTransactions.accountExternalId})
        and ${counterpart.currency} = ${financialTransactions.currency}
        and abs(${counterpart.amount}) = abs(${financialTransactions.amount})
        and ${direction(counterpart)} <> ${direction(financialTransactions)}
        and ${counterpart.occurredAt} between ${financialTransactions.occurredAt} - interval '3 days'
          and ${financialTransactions.occurredAt} + interval '3 days'
        and (${financialAccounts.type} = ${FinancialAccountType.Card}
          or ${counterpartAccount.type} = ${FinancialAccountType.Card}
          or ${financialTransactions.metadata}->>'transactionCategory' = 'TRANSFER'
          or ${counterpart.metadata}->>'transactionCategory' = 'TRANSFER'))`;
}

function seriesKey(connectionId: string, accountExternalId: string): string {
  return `${connectionId}:${accountExternalId}`;
}

/** First day of the month after a YYYY-MM month, as YYYY-MM-DD. */
function nextMonthStart(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return next.toISOString().slice(0, 10);
}
