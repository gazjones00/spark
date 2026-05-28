import { useQuery } from "@tanstack/react-query";

import { categoryConfig } from "@spark/common";
import { orpc } from "@spark/orpc";
import type { SavedTransaction } from "@spark/orpc/contract";

import {
  calculateMonthlyTotals,
  calculateNetWorth,
  calculateSpendingByCategory,
  deriveBalanceSeries,
  dominantCurrency,
  type BalanceHistory,
  type SpendingByCategory,
} from "../lib/dashboard-derivations";

// Dashboard aggregates are computed from the most recent page of transactions.
// 100 is the maximum the list endpoint allows (`ListTransactionsInputSchema.limit`).
// That is enough for current-month income/expense and the recent-5 list; we do
// NOT page the whole history for v1 — productionising server-side aggregates is
// a separate task (see TASK-002 "Out of Scope" / TASK-005).
const TRANSACTIONS_LIMIT = 100;

export interface DashboardData {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  /** Dominant account currency, used to label aggregate figures. */
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
 * Query keys deliberately match `accounts.tsx` (`["accounts"]`) and
 * `transactions.tsx` (`["transactions", input]`) so the cache is shared across
 * routes (NFR-2). All figures are derived deterministically — no `Math.random()`.
 */
export function useDashboardData(now: Date = new Date()): DashboardData {
  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: () => orpc.accounts.list.call({}),
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", { limit: TRANSACTIONS_LIMIT }],
    queryFn: () => orpc.transactions.list.call({ limit: TRANSACTIONS_LIMIT }),
  });

  const accounts = accountsQuery.data?.accounts ?? [];
  const transactions = transactionsQuery.data?.transactions ?? [];

  const { income, expenses } = calculateMonthlyTotals(transactions, now);

  const spendingByCategory: SpendingByCategory[] = calculateSpendingByCategory(
    transactions,
    now,
  ).map((entry) => ({ ...entry, fill: categoryConfig[entry.category].color }));

  return {
    netWorth: calculateNetWorth(accounts),
    monthlyIncome: income,
    monthlyExpenses: expenses,
    currency: dominantCurrency(accounts),
    spendingByCategory,
    balanceSeries: deriveBalanceSeries(transactions),
    // The API returns transactions sorted most-recent-first; take the top 5.
    recentTransactions: transactions.slice(0, 5),
    hasAccounts: accounts.length > 0,
    hasTransactions: transactions.length > 0,
    isLoading: accountsQuery.isLoading || transactionsQuery.isLoading,
    isError: accountsQuery.isError || transactionsQuery.isError,
    refetch: () => {
      void accountsQuery.refetch();
      void transactionsQuery.refetch();
    },
  };
}
