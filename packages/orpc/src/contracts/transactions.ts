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

export const GetTransactionsResponseSchema = z.object({
  transactions: z.array(SavedTransactionSchema),
});

export type SavedTransaction = z.infer<typeof SavedTransactionSchema>;

export const transactionsRouter = oc.router({
  list: oc
    .route({
      method: "GET",
      path: "/transactions",
    })
    .output(GetTransactionsResponseSchema),
});
