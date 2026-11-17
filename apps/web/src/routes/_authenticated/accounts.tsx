import * as React from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AccountGroupCard,
  AccountsSummary,
  RemoveAccountDialog,
  RenameAccountDialog,
} from "@/features/finance/components/Accounts";
import { AccountsAttentionBanner } from "@/features/finance/components/AccountsAttentionBanner";
import { OnboardingCard } from "@/features/finance/components/Home";
import { useReauthAccount } from "@/features/finance/hooks/useReauthAccount";
import { groupAccounts } from "@/features/finance/lib/account-groups";
import { dominantCurrency } from "@/features/finance/lib/dashboard-derivations";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { orpc } from "@spark/orpc";
import type { Account } from "@spark/orpc/contract";

export const Route = createFileRoute("/_authenticated/accounts")({
  // Warm the accounts cache on client-side navigations. Not on the server:
  // the oRPC fetch has no user cookie there, so the page loads its data in
  // the browser (a suspending query here made server rendering fail).
  loader: ({ context }) => {
    if (typeof window === "undefined") return;
    void context.queryClient.prefetchQuery({
      queryKey: queryKeys.accounts,
      queryFn: () => orpc.accounts.list.call({}),
    });
  },
  component: AccountsPage,
});

function AccountsPage() {
  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => orpc.accounts.list.call({}),
    refetchOnMount: "always",
  });
  const reauth = useReauthAccount();
  const [renaming, setRenaming] = React.useState<Account | null>(null);
  const [removing, setRemoving] = React.useState<Account | null>(null);

  const accounts = accountsQuery.data?.accounts ?? [];
  const currency = dominantCurrency(accounts);
  const needsAttention = accounts.filter((account) => account.syncStatus !== "OK");
  const expiringSoon = accounts.filter(
    (account) => account.syncStatus === "OK" && account.consentStatus === "EXPIRING_SOON",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Everything you've connected, in one place."
        action={
          accounts.length > 0 ? (
            <Link to="/accounts/connect" className={cn(buttonVariants())}>
              <Plus />
              Connect account
            </Link>
          ) : undefined
        }
      />

      {accountsQuery.isLoading ? (
        <AccountsSkeleton />
      ) : accountsQuery.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-foreground text-sm font-semibold">Couldn't load your accounts</p>
            <Button variant="outline" size="sm" onClick={() => void accountsQuery.refetch()}>
              <RefreshCw />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <OnboardingCard />
      ) : (
        <>
          <AccountsAttentionBanner
            accounts={needsAttention}
            expiringAccounts={expiringSoon}
            onReauth={(providerId) => reauth.mutate(providerId)}
          />
          <AccountsSummary accounts={accounts} currency={currency} />
          <div className="space-y-6">
            {groupAccounts(accounts).map((group) => (
              <AccountGroupCard
                key={group.key}
                group={group}
                currency={currency}
                onRename={setRenaming}
                onRemove={setRemoving}
                onReconnect={(account) => reauth.mutate(account.provider.providerId)}
              />
            ))}
          </div>
        </>
      )}

      <RenameAccountDialog account={renaming} onOpenChange={(open) => !open && setRenaming(null)} />
      <RemoveAccountDialog account={removing} onOpenChange={(open) => !open && setRemoving(null)} />
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading accounts">
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}
