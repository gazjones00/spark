import type {
  AccountNumber,
  AccountProvider,
  AccountType,
  Currency,
  RunningBalance,
  TransactionCategory,
  TransactionMeta,
  TransactionType,
} from "@spark/truelayer/types";

import { pgTable, text, timestamp, numeric, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const accountTypes = [
  "TRANSACTION",
  "SAVINGS",
  "BUSINESS_TRANSACTION",
  "BUSINESS_SAVINGS",
] as const satisfies readonly AccountType[];

export const currencies = ["EUR", "GBP", "USD", "AUD"] as const satisfies readonly Currency[];

export const transactionTypes = ["DEBIT", "CREDIT"] as const satisfies readonly TransactionType[];

export const transactionCategories = [
  "ATM",
  "BILL_PAYMENT",
  "CASH",
  "CASHBACK",
  "CHEQUE",
  "CORRECTION",
  "CREDIT",
  "DIRECT_DEBIT",
  "DIVIDEND",
  "FEE_CHARGE",
  "INTEREST",
  "OTHER",
  "PURCHASE",
  "STANDING_ORDER",
  "TRANSFER",
  "DEBIT",
  "UNKNOWN",
] as const satisfies readonly TransactionCategory[];

export const truelayerConnections = pgTable("truelayer_connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const truelayerAccounts = pgTable("truelayer_accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().unique(),
  connectionId: text("connection_id")
    .notNull()
    .references(() => truelayerConnections.id),
  userId: text("user_id").notNull(),
  accountType: text("account_type", { enum: accountTypes }),
  displayName: text("display_name").notNull(),
  currency: text("currency", { enum: currencies }).notNull(),
  accountNumber: jsonb("account_number").$type<AccountNumber>().notNull(),
  provider: jsonb("provider").$type<AccountProvider>().notNull(),
  updateTimestamp: timestamp("update_timestamp", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const truelayerTransactions = pgTable(
  "truelayer_transactions",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => truelayerAccounts.accountId),
    normalisedProviderTransactionId: text("normalised_provider_transaction_id"),
    providerTransactionId: text("provider_transaction_id"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
    currency: text("currency", { enum: currencies }).notNull(),
    transactionType: text("transaction_type", { enum: transactionTypes }).notNull(),
    transactionCategory: text("transaction_category", {
      enum: transactionCategories,
    }).notNull(),
    transactionClassification: jsonb("transaction_classification").$type<string[]>().notNull(),
    merchantName: text("merchant_name"),
    runningBalance: jsonb("running_balance").$type<RunningBalance>(),
    meta: jsonb("meta").$type<TransactionMeta>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("transaction_account_unique_idx").on(table.transactionId, table.accountId),
  ],
);
