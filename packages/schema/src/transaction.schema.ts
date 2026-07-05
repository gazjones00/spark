import { z } from "zod";
import { CategoryIdSchema, CategorySourceSchema, MerchantRefSchema } from "./enrichment.schema.ts";
import {
  CurrencySchema,
  RunningBalanceSchema,
  TransactionCategorySchema,
  TransactionMetaSchema,
  TransactionTypeSchema,
} from "./truelayer.schema.ts";

export const SavedTransactionSchema = z
  .object({
    id: z.uuid(),
    transactionId: z.string(),
    accountId: z.string(),
    normalisedProviderTransactionId: z.string().nullable(),
    providerTransactionId: z.string().nullable(),
    timestamp: z.iso.datetime(),
    description: z.string(),
    amount: z.string(),
    currency: CurrencySchema,
    transactionType: TransactionTypeSchema,
    transactionCategory: TransactionCategorySchema,
    transactionClassification: z.array(z.string()),
    merchantName: z.string().nullable(),
    runningBalance: RunningBalanceSchema.nullable(),
    meta: TransactionMetaSchema.nullable(),
    // Derived enrichment layer (never provider data): canonical spending
    // category (built-in value or custom category id), where it came from,
    // and the resolved normalized merchant.
    category: CategoryIdSchema,
    categorySource: CategorySourceSchema,
    merchant: MerchantRefSchema.nullable(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "SavedTransaction" });

export type SavedTransaction = z.infer<typeof SavedTransactionSchema>;

export const CreateTransactionSchema = SavedTransactionSchema.omit({
  id: true,
  updatedAt: true,
  // Enrichment is derived, never written alongside provider data.
  category: true,
  categorySource: true,
  merchant: true,
}).meta({ id: "CreateTransaction" });

export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;

export const ListTransactionsInputSchema = z
  .object({
    limit: z.coerce.number().pipe(z.int().min(1).max(100)).optional(),
    cursor: z.string().optional(),
    accountId: z.string().optional(),
    /** Filters on the derived canonical category (built-in or custom id). */
    category: CategoryIdSchema.optional(),
    search: z.string().trim().min(1).max(100).optional(),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  })
  .meta({ id: "ListTransactionsInput" });

export type ListTransactionsInput = z.infer<typeof ListTransactionsInputSchema>;

export const ListTransactionsResponseSchema = z
  .object({
    transactions: z.array(SavedTransactionSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
  .meta({ id: "ListTransactionsResponse" });

export type ListTransactionsResponse = z.infer<typeof ListTransactionsResponseSchema>;

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const MonthlySummaryInputSchema = z
  .object({
    /** UTC calendar month, formatted YYYY-MM. Defaults to the current month. */
    month: z.string().regex(MONTH_REGEX).optional(),
  })
  .meta({ id: "MonthlySummaryInput" });

export type MonthlySummaryInput = z.infer<typeof MonthlySummaryInputSchema>;

export const CategorySpendSchema = z
  .object({
    /**
     * Enriched category reference: a built-in spending category value or a
     * custom category id (OTHER for rows not yet enriched).
     */
    category: z.string(),
    /** Decimal string: SQL numeric sum of the month's DEBIT amounts. */
    total: z.string(),
    transactionCount: z.number().int(),
  })
  .meta({ id: "CategorySpend" });

export type CategorySpend = z.infer<typeof CategorySpendSchema>;

export const CurrencyMonthlySummarySchema = z
  .object({
    currency: CurrencySchema,
    /** Decimal strings: SQL numeric sums — no float accumulation server-side. */
    income: z.string(),
    expenses: z.string(),
    transactionCount: z.number().int(),
    /** Spending categories with a non-zero debit total, sorted descending. */
    categories: z.array(CategorySpendSchema),
  })
  .meta({ id: "CurrencyMonthlySummary" });

export type CurrencyMonthlySummary = z.infer<typeof CurrencyMonthlySummarySchema>;

export const MonthlySummaryResponseSchema = z
  .object({
    month: z.string().regex(MONTH_REGEX),
    /** One entry per currency, sorted by transaction count descending. */
    totals: z.array(CurrencyMonthlySummarySchema),
  })
  .meta({ id: "MonthlySummaryResponse" });

export type MonthlySummaryResponse = z.infer<typeof MonthlySummaryResponseSchema>;

export const BalanceSeriesInputSchema = z
  .object({
    /** Window length in days ending today (UTC). Defaults to 90. */
    days: z.coerce.number().pipe(z.int().min(7).max(365)).optional(),
  })
  .meta({ id: "BalanceSeriesInput" });

export type BalanceSeriesInput = z.infer<typeof BalanceSeriesInputSchema>;

export const BalanceSeriesPointSchema = z
  .object({
    /** UTC calendar day, formatted YYYY-MM-DD. */
    date: z.string(),
    /** Decimal string end-of-day balance (carried forward across gap days). */
    balance: z.string(),
    currency: CurrencySchema,
  })
  .meta({ id: "BalanceSeriesPoint" });

export type BalanceSeriesPoint = z.infer<typeof BalanceSeriesPointSchema>;

export const BalanceSeriesResponseSchema = z
  .object({
    /** At most one point per day in the requested window. */
    points: z.array(BalanceSeriesPointSchema),
  })
  .meta({ id: "BalanceSeriesResponse" });

export type BalanceSeriesResponse = z.infer<typeof BalanceSeriesResponseSchema>;
