import type {
  AccountNumber,
  AccountProvider,
  RunningBalance,
  TransactionMeta,
} from "@spark/truelayer/types";
import {
  AccountType,
  Currency,
  TransactionCategory,
  TransactionType,
} from "@spark/truelayer/schemas";

import { pgTable, text, timestamp, numeric, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

const enumValues = <T extends Record<string, string>>(obj: T) =>
  Object.values(obj) as [T[keyof T], ...T[keyof T][]];

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
  accountType: text("account_type", { enum: enumValues(AccountType) }),
  displayName: text("display_name").notNull(),
  currency: text("currency", { enum: enumValues(Currency) }).notNull(),
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
    currency: text("currency", { enum: enumValues(Currency) }).notNull(),
    transactionType: text("transaction_type", { enum: enumValues(TransactionType) }).notNull(),
    transactionCategory: text("transaction_category", {
      enum: enumValues(TransactionCategory),
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
