import { pgTable, text, boolean, pgEnum } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

export const themeEnum = pgEnum("theme", ["system", "light", "dark"]);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  largeTransactions: boolean("large_transactions").default(true).notNull(),
  lowBalance: boolean("low_balance").default(true).notNull(),
  budgetOverspend: boolean("budget_overspend").default(true).notNull(),
  syncFailures: boolean("sync_failures").default(true).notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayCurrency: text("display_currency").default("GBP").notNull(),
  theme: themeEnum("theme").default("system").notNull(),
});
