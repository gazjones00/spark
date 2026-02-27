import { z } from "zod";
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
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "SavedTransaction" });

export type SavedTransaction = z.infer<typeof SavedTransactionSchema>;

export const CreateTransactionSchema = SavedTransactionSchema.omit({
  id: true,
  updatedAt: true,
}).meta({ id: "CreateTransaction" });

export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;

export const UpdateTransactionSchema = CreateTransactionSchema.partial()
  .extend({ id: z.uuid() })
  .meta({ id: "UpdateTransaction" });

export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;

export const ListTransactionsInputSchema = z
  .object({
    limit: z.coerce.number().pipe(z.int().min(1).max(100)).optional(),
    cursor: z.string().optional(),
    accountId: z.string().optional(),
    category: TransactionCategorySchema.optional(),
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
