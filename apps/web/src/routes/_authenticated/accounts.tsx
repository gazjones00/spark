import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AccountsList } from "@/features/finance/components/accounts-list";
import { ConnectAccountModal } from "@/features/finance/components/connect-account-modal";
import { mockAccounts } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
});

function AccountsPage() {
  const accounts = mockAccounts;

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

      <AccountsList accounts={accounts} />
    </div>
  );
}
