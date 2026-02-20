import { oc } from "@orpc/contract";
import {
  CurrencySchema,
  RunningBalanceSchema,
  TransactionCategorySchema,
  TransactionMetaSchema,
  TransactionTypeSchema,
} from "@spark/truelayer/schemas";
import { z } from "zod";

export const SavedTransactionSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  accountId: z.string(),
  normalisedProviderTransactionId: z.string().nullable(),
  providerTransactionId: z.string().nullable(),
  timestamp: z.string(),
  description: z.string(),
  amount: z.string(),
  currency: CurrencySchema,
  transactionType: TransactionTypeSchema,
  transactionCategory: TransactionCategorySchema,
  transactionClassification: z.array(z.string()),
  merchantName: z.string().nullable(),
  runningBalance: RunningBalanceSchema.nullable(),
  meta: TransactionMetaSchema.nullable(),
  updatedAt: z.string(),
});

export const ListTransactionsInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  accountId: z.string().optional(),
  category: TransactionCategorySchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const ListTransactionsResponseSchema = z.object({
  transactions: z.array(SavedTransactionSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type SavedTransaction = z.infer<typeof SavedTransactionSchema>;
export type ListTransactionsInput = z.infer<typeof ListTransactionsInputSchema>;
export type ListTransactionsResponse = z.infer<typeof ListTransactionsResponseSchema>;

export const transactionsRouter = oc.router({
  list: oc
    .route({
      method: "GET",
      path: "/transactions",
    })
    .input(ListTransactionsInputSchema)
    .output(ListTransactionsResponseSchema),
});
