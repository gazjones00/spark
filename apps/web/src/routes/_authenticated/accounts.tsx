import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { AccountsList } from "@/features/finance/components/AccountList";
import { AccountsAttentionBanner } from "@/features/finance/components/AccountsAttentionBanner";
import { ConnectAccountModal } from "@/features/finance/components/ConnectAccountModal";
import { useReauthAccount } from "@/features/finance/hooks/useReauthAccount";
import { orpc } from "@spark/orpc";

export const Route = createFileRoute("/_authenticated/accounts")({
  // Warm the accounts cache before render — the page reads it with
  // useSuspenseQuery, so a prefetch avoids suspending on navigation. SSR is
  // skipped: the oRPC fetch has no user cookie server-side.
  loader: ({ context }) => {
    if (typeof window === "undefined") return;
    void context.queryClient.prefetchQuery({
      queryKey: ["accounts"],
      queryFn: () => orpc.accounts.list.call({}),
    });
  },
  component: AccountsPage,
});

function AccountsPage() {
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery({
    queryKey: ["accounts"],
    queryFn: () => orpc.accounts.list.call({}),
    refetchOnMount: "always",
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orpc.accounts.delete.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const reauthMutation = useReauthAccount();

  const accountsNeedingAttention = data.accounts.filter((account) => account.syncStatus !== "OK");

  const handleEdit = (id: string) => {
    const account = data.accounts.find((a) => a.id === id);
    if (!account) return;

    const newName = window.prompt("Edit account name:", account.displayName);
    if (newName && newName !== account.displayName) {
      orpc.accounts.update.call({ id, displayName: newName }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this account?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connections"
        title="Accounts"
        description="Manage your connected bank accounts"
        action={
          <ConnectAccountModal
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Connect Account
              </Button>
            }
          />
        }
      />

      <AccountsAttentionBanner
        accounts={accountsNeedingAttention}
        onReauth={(providerId) => reauthMutation.mutate(providerId)}
      />

      <AccountsList
        accounts={data.accounts}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReauth={(providerId) => reauthMutation.mutate(providerId)}
      />
    </div>
  );
}
