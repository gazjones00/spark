import {
  pgTable,
  text,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { enumValues, SyncStatus } from "@spark/common";
import type { SyncStatusType } from "@spark/common";
import { user } from "./auth.ts";

export const connectorConnections = pgTable(
  "connector_connections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    providerName: text("provider_name").notNull(),
    environment: text("environment").notNull(),
    encryptedCredentials: text("encrypted_credentials").notNull(),
    credentialKeyId: text("credential_key_id").notNull(),
    capabilities: jsonb("capabilities").$type<string[]>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    syncStatus: text("sync_status", { enum: enumValues(SyncStatus) })
      .$type<SyncStatusType>()
      .notNull()
      .default(SyncStatus.OK),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true }).notNull().defaultNow(),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastSyncErrorCode: text("last_sync_error_code"),
    lastSyncErrorMessage: text("last_sync_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("connector_connections_user_id_idx").on(table.userId),
    index("connector_connections_provider_id_idx").on(table.providerId),
    index("connector_connections_next_sync_idx").on(table.syncStatus, table.nextSyncAt),
  ],
);

export const connectorSyncRuns = pgTable(
  "connector_sync_runs",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    status: text("status", { enum: ["success", "partial", "failed"] }).notNull(),
    recordsRead: integer("records_read").notNull().default(0),
    recordsWritten: integer("records_written").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("connector_sync_runs_connection_id_idx").on(table.connectionId),
    index("connector_sync_runs_user_id_idx").on(table.userId),
  ],
);

export const connectorSyncCursors = pgTable(
  "connector_sync_cursors",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(),
    cursor: text("cursor"),
    checkpoint: text("checkpoint"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("connector_sync_cursors_connection_resource_idx").on(
      table.connectionId,
      table.resource,
    ),
  ],
);

export const rawProviderRecords = pgTable(
  "raw_provider_records",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    resource: text("resource").notNull(),
    externalId: text("external_id").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("raw_provider_records_connection_resource_external_idx").on(
      table.connectionId,
      table.resource,
      table.externalId,
      table.observedAt,
    ),
    index("raw_provider_records_connection_id_idx").on(table.connectionId),
  ],
);

export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    externalId: text("external_id").notNull(),
    type: text("type").notNull(),
    displayName: text("display_name").notNull(),
    currency: text("currency").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("financial_accounts_connection_external_idx").on(
      table.connectionId,
      table.externalId,
    ),
    index("financial_accounts_user_id_idx").on(table.userId),
  ],
);

export const instruments = pgTable(
  "instruments",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    externalId: text("external_id").notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    isin: text("isin"),
    currency: text("currency"),
    type: text("type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("instruments_provider_external_idx").on(table.providerId, table.externalId),
    index("instruments_ticker_idx").on(table.ticker),
    index("instruments_isin_idx").on(table.isin),
  ],
);

export const financialTransactions = pgTable(
  "financial_transactions",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    accountExternalId: text("account_external_id").notNull(),
    providerId: text("provider_id").notNull(),
    externalId: text("external_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
    currency: text("currency").notNull(),
    instrumentExternalId: text("instrument_external_id"),
    quantity: numeric("quantity", { precision: 24, scale: 8 }),
    price: numeric("price", { precision: 19, scale: 8 }),
    fees: numeric("fees", { precision: 19, scale: 4 }),
    tax: numeric("tax", { precision: 19, scale: 4 }),
    fxRate: numeric("fx_rate", { precision: 19, scale: 8 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("financial_transactions_connection_external_idx").on(
      table.connectionId,
      table.externalId,
    ),
    index("financial_transactions_connection_id_idx").on(table.connectionId),
    // Serves the list query's account-scoped keyset pages: equality on the
    // account, backward scan on (occurred_at, id) — no sort node. Also covers
    // plain account_external_id lookups as its leftmost prefix.
    index("financial_transactions_account_occurred_idx").on(
      table.accountExternalId,
      table.occurredAt,
      table.id,
    ),
    index("financial_transactions_occurred_at_idx").on(table.occurredAt),
  ],
);

/**
 * Incremental daily aggregates over `financial_transactions`, keyed on our
 * own identifiers (connection + account external id + UTC day + currency +
 * category) so the read model survives provider-model changes. Buckets are
 * RECOMPUTED from base rows — never incremented — inside the sync write
 * transaction: the sync path updates existing transactions on conflict, so
 * `+= amount` maintenance would drift. A full recompute always converges to
 * the same values.
 */
export const transactionDailyRollups = pgTable(
  "transaction_daily_rollups",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    accountExternalId: text("account_external_id").notNull(),
    providerId: text("provider_id").notNull(),
    /** UTC calendar day of the bucket. */
    day: date("day").notNull(),
    currency: text("currency").notNull(),
    category: text("category").notNull(),
    /** Sum of |amount| over the bucket's DEBIT transactions. */
    debitTotal: numeric("debit_total", { precision: 19, scale: 4 }).notNull(),
    /** Sum of |amount| over the bucket's CREDIT transactions. */
    creditTotal: numeric("credit_total", { precision: 19, scale: 4 }).notNull(),
    transactionCount: integer("transaction_count").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("transaction_daily_rollups_bucket_idx").on(
      table.connectionId,
      table.accountExternalId,
      table.day,
      table.currency,
      table.category,
    ),
    index("transaction_daily_rollups_user_day_idx").on(table.userId, table.day),
  ],
);

/**
 * End-of-day balance per (connection, account, UTC day), sourced from the
 * `runningBalance` of the day's latest transaction. Only days where some
 * transaction carried a running balance have a row; readers carry the last
 * value forward across gaps (mirroring the dashboard's original client-side
 * semantics). Recomputed alongside `transaction_daily_rollups`. Historical
 * net-worth snapshotting may later replace this as the series source.
 */
export const accountDailyBalances = pgTable(
  "account_daily_balances",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    accountExternalId: text("account_external_id").notNull(),
    providerId: text("provider_id").notNull(),
    /** UTC calendar day. */
    day: date("day").notNull(),
    currency: text("currency").notNull(),
    endOfDayBalance: numeric("end_of_day_balance", { precision: 19, scale: 4 }).notNull(),
    /** Timestamp of the transaction that provided the balance (day tie-break). */
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("account_daily_balances_bucket_idx").on(
      table.connectionId,
      table.accountExternalId,
      table.day,
    ),
    index("account_daily_balances_user_day_idx").on(table.userId, table.day),
  ],
);

export const holdings = pgTable(
  "holdings",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    accountExternalId: text("account_external_id").notNull(),
    providerId: text("provider_id").notNull(),
    externalId: text("external_id").notNull(),
    instrumentExternalId: text("instrument_external_id").notNull(),
    quantity: numeric("quantity", { precision: 24, scale: 8 }).notNull(),
    availableQuantity: numeric("available_quantity", { precision: 24, scale: 8 }),
    averagePrice: numeric("average_price", { precision: 19, scale: 8 }),
    currentPrice: numeric("current_price", { precision: 19, scale: 8 }),
    currency: text("currency").notNull(),
    value: numeric("value", { precision: 19, scale: 4 }),
    costBasis: numeric("cost_basis", { precision: 19, scale: 4 }),
    unrealizedProfitLoss: numeric("unrealized_profit_loss", { precision: 19, scale: 4 }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("holdings_connection_external_idx").on(table.connectionId, table.externalId),
    index("holdings_connection_id_idx").on(table.connectionId),
  ],
);

export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    accountExternalId: text("account_external_id").notNull(),
    providerId: text("provider_id").notNull(),
    currency: text("currency").notNull(),
    cash: numeric("cash", { precision: 19, scale: 4 }).notNull(),
    availableCash: numeric("available_cash", { precision: 19, scale: 4 }),
    blockedCash: numeric("blocked_cash", { precision: 19, scale: 4 }),
    invested: numeric("invested", { precision: 19, scale: 4 }),
    total: numeric("total", { precision: 19, scale: 4 }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("balance_snapshots_connection_account_observed_idx").on(
      table.connectionId,
      table.accountExternalId,
      table.observedAt,
    ),
    index("balance_snapshots_connection_observed_idx").on(table.connectionId, table.observedAt),
  ],
);

export const portfolioSnapshots = pgTable(
  "portfolio_snapshots",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    accountExternalId: text("account_external_id").notNull(),
    providerId: text("provider_id").notNull(),
    currency: text("currency").notNull(),
    cashValue: numeric("cash_value", { precision: 19, scale: 4 }).notNull(),
    investmentValue: numeric("investment_value", { precision: 19, scale: 4 }).notNull(),
    totalValue: numeric("total_value", { precision: 19, scale: 4 }).notNull(),
    costBasis: numeric("cost_basis", { precision: 19, scale: 4 }),
    realizedProfitLoss: numeric("realized_profit_loss", { precision: 19, scale: 4 }),
    unrealizedProfitLoss: numeric("unrealized_profit_loss", { precision: 19, scale: 4 }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("portfolio_snapshots_connection_account_observed_idx").on(
      table.connectionId,
      table.accountExternalId,
      table.observedAt,
    ),
    index("portfolio_snapshots_connection_observed_idx").on(table.connectionId, table.observedAt),
  ],
);
