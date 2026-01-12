import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AccountsList } from "@/features/finance/components/accounts-list";
import { ConnectAccountModal } from "@/features/finance/components/ConnectAccountModal";
import { orpc } from "@spark/orpc";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
});

function AccountsPage() {
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery({
    queryKey: ["accounts"],
    queryFn: () => orpc.accounts.list.call({}),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orpc.accounts.delete.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground text-sm">Manage your connected bank accounts</p>
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

      <AccountsList accounts={data.accounts} onEdit={handleEdit} onDelete={handleDelete} />
    </div>
  );
}
