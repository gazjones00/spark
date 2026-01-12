import { AccountCard } from "../AccountCard";
import type { Account } from "@spark/truelayer/types";

interface AccountsListProps {
  accounts: (Account & { id: string })[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function AccountsList({ accounts, onEdit, onDelete }: AccountsListProps) {
  if (accounts.length === 0) {
    return (
      <div className="text-muted-foreground rounded-none border border-dashed p-8 text-center">
        <p className="text-sm">No accounts connected yet.</p>
        <p className="text-xs">Connect your first bank account to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard
          key={account.accountId}
          account={account}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
