import { createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCw, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickStats } from "@/features/finance/components/QuickStats";
import { BalanceHistoryChart } from "@/features/finance/components/BalanceHistoryChart";
import { SpendingChart } from "@/features/finance/components/SpendingChart";
import { RecentTransactions } from "@/features/finance/components/RecentTransactions";
import { ConnectAccountModal } from "@/features/finance/components/ConnectAccountModal";
import { useDashboardData, type DashboardData } from "@/features/finance/hooks/useDashboardData";
import { orpc } from "@spark/orpc";
import { useAuth } from "@spark/auth/react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  // Warm the shared accounts cache on client-side navigations. SSR is
  // skipped: the oRPC fetch has no user cookie server-side, so a prefetch
  // there would dehydrate a 401 into the client cache.
  loader: ({ context }) => {
    if (typeof window === "undefined") return;
    void context.queryClient.prefetchQuery({
      queryKey: ["accounts"],
      queryFn: () => orpc.accounts.list.call({}),
    });
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const data = useDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={`Welcome back${user?.name ? `, ${user.name}` : ""}. Here's your financial overview.`}
      />

      <DashboardContent data={data} />
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  if (data.isLoading) {
    return <DashboardSkeleton />;
  }

  if (data.isError) {
    return <DashboardError onRetry={data.refetch} />;
  }

  if (!data.hasAccounts) {
    return <DashboardEmpty />;
  }

  return (
    <>
      <QuickStats
        netWorth={data.netWorth}
        monthlyIncome={data.monthlyIncome}
        monthlyExpenses={data.monthlyExpenses}
        currency={data.currency}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <BalanceHistoryChart data={data.balanceSeries} currency={data.currency} />
        <SpendingChart data={data.spendingByCategory} currency={data.currency} />
      </div>

      <RecentTransactions transactions={data.recentTransactions} />
    </>
  );
}

const SKELETON_STAT_KEYS = ["net-worth", "income", "expenses"] as const;

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {SKELETON_STAT_KEYS.map((key) => (
          <Card key={key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-28" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[280px] w-full" />
        <Skeleton className="h-[280px] w-full" />
      </div>
      <Skeleton className="h-[280px] w-full" />
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-none border border-dashed p-8 text-center">
      <div>
        <p className="text-foreground text-sm font-medium">Couldn't load your dashboard</p>
        <p className="text-xs">Something went wrong fetching your accounts and transactions.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="size-4" />
        Retry
      </Button>
    </div>
  );
}

function DashboardEmpty() {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-none border border-dashed p-8 text-center">
      <Wallet className="size-8" />
      <div>
        <p className="text-foreground text-sm font-medium">No accounts connected yet</p>
        <p className="text-xs">
          Connect a bank account to see your real balances, spending, and transactions.
        </p>
      </div>
      <ConnectAccountModal
        trigger={
          <Button className="gap-2">
            <Plus className="size-4" />
            Connect Account
          </Button>
        }
      />
    </div>
  );
}
