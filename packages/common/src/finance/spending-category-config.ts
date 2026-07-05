import type { CategoryDescriptor, SpendingCategory } from "@spark/schema";

/**
 * Canonical spending category → display config (label + chart colour token).
 */
export const spendingCategoryConfig: Record<SpendingCategory, { label: string; color: string }> = {
  GROCERIES: { label: "Groceries", color: "var(--chart-1)" },
  EATING_OUT: { label: "Eating Out", color: "var(--chart-2)" },
  TRANSPORT: { label: "Transport", color: "var(--chart-3)" },
  HOUSING: { label: "Housing", color: "var(--chart-4)" },
  UTILITIES: { label: "Utilities", color: "var(--chart-5)" },
  SUBSCRIPTIONS: { label: "Subscriptions", color: "var(--chart-1)" },
  SHOPPING: { label: "Shopping", color: "var(--chart-2)" },
  ENTERTAINMENT: { label: "Entertainment", color: "var(--chart-3)" },
  HEALTH: { label: "Health", color: "var(--chart-4)" },
  CASH: { label: "Cash", color: "var(--chart-5)" },
  INCOME: { label: "Income", color: "var(--chart-1)" },
  TRANSFERS: { label: "Transfers", color: "var(--chart-2)" },
  INVESTING: { label: "Investing", color: "var(--chart-3)" },
  FEES: { label: "Fees", color: "var(--chart-4)" },
  OTHER: { label: "Other", color: "var(--chart-5)" },
};

/**
 * Built-in taxonomy as display descriptors (id = the enum value). Shared by
 * the categories API and the client's offline fallback so the two can't
 * drift in shape.
 */
export function builtInCategoryDescriptors(): CategoryDescriptor[] {
  return Object.entries(spendingCategoryConfig).map(([id, config]) => ({
    id,
    label: config.label,
    color: config.color,
    builtIn: true,
  }));
}
