import { pgTable, text, timestamp, integer, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { financialTransactions } from "./connectors.ts";

/**
 * Derived enrichment layer over the canonical transaction tables.
 *
 * Strict layering: provider tables (`financial_transactions`,
 * `raw_provider_records`) are immutable input and are NEVER written to by
 * this layer — the sync path's `onConflictDoUpdate` would clobber anything
 * stored there. Everything here is either user data (rules, overrides) or
 * re-derivable output (enrichments, merchants), so dropping the derived
 * tables and re-running enrichment restores identical state.
 */

/**
 * Rule matchers in disjunctive normal form (OR of AND-groups). Shape is
 * validated by RuleMatchersSchema in @spark/schema; kept loose here so the
 * db package doesn't depend on the schema package.
 */
export interface CategoryRuleMatchers {
  groups: Array<
    Array<{
      field: string;
      op: string;
      value: string | number;
      valueMax?: number;
    }>
  >;
}

/**
 * User-defined spending categories, extending the built-in taxonomy. Rules,
 * overrides, and enrichments reference them by id (a category reference
 * column holds either a built-in SpendingCategory value or one of these
 * ids). Deletion is guarded server-side while rules/overrides reference the
 * category, so stored references never dangle.
 */
export const userCategories = pgTable(
  "user_categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Lowercased name, unique per user (case-insensitive duplicates). */
    normalizedName: text("normalized_name").notNull(),
    /** CSS chart-palette token, validated by CategoryColorSchema. */
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_categories_user_name_idx").on(table.userId, table.normalizedName),
    index("user_categories_user_id_idx").on(table.userId),
  ],
);

export const merchants = pgTable(
  "merchants",
  {
    id: text("id").primaryKey(),
    /** Output of normalizeMerchant() — the canonical matching key. */
    normalizedName: text("normalized_name").notNull(),
    displayName: text("display_name").notNull(),
    /** Extra normalized aliases that also resolve to this merchant. */
    matchPatterns: jsonb("match_patterns").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("merchants_normalized_name_idx").on(table.normalizedName)],
);

export const categoryRules = pgTable(
  "category_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    matchers: jsonb("matchers").$type<CategoryRuleMatchers>().notNull(),
    category: text("category").notNull(),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("category_rules_user_id_idx").on(table.userId)],
);

export const transactionCategoryOverrides = pgTable(
  "transaction_category_overrides",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => financialTransactions.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("transaction_category_overrides_transaction_idx").on(table.transactionId),
    index("transaction_category_overrides_user_id_idx").on(table.userId),
  ],
);

export const transactionEnrichments = pgTable(
  "transaction_enrichments",
  {
    /** Keyed 1:1 by canonical transaction id — the idempotency anchor. */
    transactionId: text("transaction_id")
      .primaryKey()
      .references(() => financialTransactions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    /** PROVIDER_DEFAULT | RULE | USER_OVERRIDE (CategorySource in @spark/schema). */
    source: text("source").notNull(),
    merchantId: text("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    derivedAt: timestamp("derived_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("transaction_enrichments_user_id_idx").on(table.userId),
    index("transaction_enrichments_user_category_idx").on(table.userId, table.category),
    index("transaction_enrichments_merchant_id_idx").on(table.merchantId),
  ],
);
