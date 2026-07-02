import { useQuery } from "@tanstack/react-query";

import { categoryConfig } from "@spark/common";
import { orpc } from "@spark/orpc";
import type { SavedTransaction } from "@spark/orpc/contract";

import {
  calculateNetWorth,
  dominantCurrency,
  type BalanceHistory,
  type SpendingByCategory,
} from "../lib/dashboard-derivations";

/** The dashboard's recent-activity list shows the five newest transactions. */
const RECENT_TRANSACTIONS_LIMIT = 5;

export interface DashboardData {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  /** Currency of the displayed monthly summary, used to label aggregate figures. */
  currency: string | undefined;
  spendingByCategory: SpendingByCategory[];
  balanceSeries: BalanceHistory[];
  recentTransactions: SavedTransaction[];
  hasAccounts: boolean;
  hasTransactions: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Single source of dashboard data, wired to the live oRPC API.
 *
 * Monthly totals, category spend, and the balance series come from the
 * server-side rollup aggregates — computed in SQL over full history, so a
 * month with hundreds of transactions is fully counted (the old client-side
 * derivation silently truncated at the list endpoint's 100-row page).
 * Net worth stays derived from the accounts list, and recent activity still
 * reads a small `transactions.list` page.
 */
export function useDashboardData(): DashboardData {
  const accountsQuery = useQuery({
    // Key matches accounts.tsx so the cache is shared across routes.
    queryKey: ["accounts"],
    queryFn: () => orpc.accounts.list.call({}),
  });

  const recentQuery = useQuery({
    queryKey: ["transactions", { limit: RECENT_TRANSACTIONS_LIMIT }],
    queryFn: () => orpc.transactions.list.call({ limit: RECENT_TRANSACTIONS_LIMIT }),
  });

  const summaryQuery = useQuery({
    queryKey: ["transactions", "monthly-summary"],
    queryFn: () => orpc.transactions.monthlySummary.call({}),
  });

  const seriesQuery = useQuery({
    queryKey: ["transactions", "balance-series"],
    queryFn: () => orpc.transactions.balanceSeries.call({}),
  });

  const accounts = accountsQuery.data?.accounts ?? [];
  const recentTransactions = recentQuery.data?.transactions ?? [];
  const accountCurrency = dominantCurrency(accounts);

  // Aggregates are per-currency (cross-currency sums are meaningless without
  // FX); display the entry matching the dominant account currency, falling
  // back to the busiest one. The returned currency follows the summary we
  // actually display so a fallback's totals aren't labelled with the wrong
  // currency.
  const totals = summaryQuery.data?.totals ?? [];
  const summary = totals.find((entry) => entry.currency === accountCurrency) ?? totals[0];
  const currency = summary?.currency ?? accountCurrency;

  // Rollups store raw provider categories; anything the UI has no config for
  // is folded into UNKNOWN (merged, since the pie keys slices by category).
  const spendingByCategory: SpendingByCategory[] = [];
  for (const entry of summary?.categories ?? []) {
    const category = (
      entry.category in categoryConfig ? entry.category : "UNKNOWN"
    ) as SpendingByCategory["category"];
    const amount = Number(entry.total);
    const existing = spendingByCategory.find((slice) => slice.category === category);
    if (existing) {
      existing.amount += amount;
    } else {
      spendingByCategory.push({ category, amount, fill: categoryConfig[category].color });
    }
  }

  const balanceSeries: BalanceHistory[] = (seriesQuery.data?.points ?? []).map((point) => ({
    date: point.date,
    balance: Number(point.balance),
  }));

  return {
    netWorth: calculateNetWorth(accounts),
    monthlyIncome: summary ? Number(summary.income) : 0,
    monthlyExpenses: summary ? Number(summary.expenses) : 0,
    currency,
    spendingByCategory,
    balanceSeries,
    recentTransactions,
    hasAccounts: accounts.length > 0,
    hasTransactions: recentTransactions.length > 0,
    isLoading:
      accountsQuery.isLoading ||
      recentQuery.isLoading ||
      summaryQuery.isLoading ||
      seriesQuery.isLoading,
    isError:
      accountsQuery.isError || recentQuery.isError || summaryQuery.isError || seriesQuery.isError,
    refetch: () => {
      void accountsQuery.refetch();
      void recentQuery.refetch();
      void summaryQuery.refetch();
      void seriesQuery.refetch();
    },
  };
}
