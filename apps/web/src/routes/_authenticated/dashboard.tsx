import { createFileRoute } from "@tanstack/react-router";

import { QuickStats } from "@/features/finance/components/quick-stats";
import { BalanceHistoryChart } from "@/features/finance/components/balance-history-chart";
import { SpendingChart } from "@/features/finance/components/spending-chart";
import { RecentTransactions } from "@/features/finance/components/recent-transactions";
import {
  mockAccounts,
  mockTransactions,
  mockBalanceHistory,
  mockSpendingByCategory,
  getTotalBalance,
  getMonthlyIncome,
  getMonthlyExpenses,
} from "@/lib/mock-data";
import { useAuth } from "@spark/auth/react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const totalBalance = getTotalBalance(mockAccounts);
  const monthlyIncome = getMonthlyIncome(mockTransactions);
  const monthlyExpenses = getMonthlyExpenses(mockTransactions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Welcome back, {user?.name}! Here's your financial overview.
        </p>
      </div>

      <QuickStats
        netWorth={totalBalance}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <BalanceHistoryChart data={mockBalanceHistory} />
        <SpendingChart data={mockSpendingByCategory} />
      </div>

      <RecentTransactions transactions={mockTransactions} />
    </div>
  );
}
