import * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountsAttentionBanner } from "@/features/finance/components/AccountsAttentionBanner";
import {
  AccountsOverview,
  MonthSummaryCard,
  NetWorthCard,
  OnboardingCard,
  RecentActivity,
  SpendingBreakdown,
} from "@/features/finance/components/Home";
import { useDashboardData, type DashboardData } from "@/features/finance/hooks/useDashboardData";
import type { SeriesRange } from "@/features/finance/lib/series-ranges";
import { useReauthAccount } from "@/features/finance/hooks/useReauthAccount";
import { greeting } from "@/features/finance/lib/dates";
import { useHydrated } from "@/lib/use-hydrated";
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
  const { user: sessionUser } = useAuth();
  const hydrated = useHydrated();
  const user = hydrated ? sessionUser : null;
  const [range, setRange] = React.useState<SeriesRange>("3M");
  const data = useDashboardData({ range });

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const isNew = !data.isLoading && !data.isError && !data.hasAccounts;
  // Time-of-day greeting depends on the viewer's clock, so it waits for the
  // client; the server renders the neutral title.
  const title = isNew
    ? `Welcome to Spark${firstName ? `, ${firstName}` : ""}`
    : hydrated
      ? `${greeting()}${firstName ? `, ${firstName}` : ""}`
      : "Home";
  const today = hydrated
    ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={isNew ? "Let's get you set up." : today} />
      <DashboardContent data={data} range={range} onRangeChange={setRange} />
    </div>
  );
}

function DashboardContent({
  data,
  range,
  onRangeChange,
}: {
  data: DashboardData;
  range: SeriesRange;
  onRangeChange: (range: SeriesRange) => void;
}) {
  const reauth = useReauthAccount();

  if (data.isLoading) {
    return <DashboardSkeleton />;
  }

  if (data.isError) {
    return <DashboardError onRetry={data.refetch} />;
  }

  if (!data.hasAccounts) {
    return <OnboardingCard />;
  }

  const needsAttention = data.accounts.filter((account) => account.syncStatus !== "OK");
  const expiringSoon = data.accounts.filter(
    (account) => account.syncStatus === "OK" && account.consentStatus === "EXPIRING_SOON",
  );

  return (
    <div className="space-y-6">
      <AccountsAttentionBanner
        accounts={needsAttention}
        expiringAccounts={expiringSoon}
        onReauth={(providerId) => reauth.mutate(providerId)}
      />

      {/* `grid-cols-1` keeps the single phone column from growing past the
          screen to fit an unwrapped line of text. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NetWorthCard
            netWorth={data.netWorth}
            currency={data.currency}
            series={data.balanceSeries}
            range={range}
            onRangeChange={onRangeChange}
          />
        </div>
        <MonthSummaryCard
          income={data.monthlyIncome}
          expenses={data.monthlyExpenses}
          currency={data.currency}
          previousMonth={data.previousMonth}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SpendingBreakdown data={data.spendingByCategory} currency={data.currency} />
          <RecentActivity transactions={data.recentTransactions} accounts={data.accounts} />
        </div>
        <AccountsOverview accounts={data.accounts} currency={data.currency} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your overview">
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[340px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[340px] rounded-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[300px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <div>
          <p className="text-foreground text-sm font-semibold">Couldn't load your dashboard</p>
          <p className="text-muted-foreground text-sm">
            Something went wrong fetching your accounts and transactions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
