import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Account } from "@spark/truelayer/types";
import { formatAccountNumber, formatAccountType } from "../utils";

interface SelectAccountsStepProps {
  accounts: Account[];
  selectedAccountIds: Set<string>;
  onToggle: (accountId: string) => void;
  onSelectAll: () => void;
  onSave: () => void;
}

export function SelectAccountsStep({
  accounts,
  selectedAccountIds,
  onToggle,
  onSelectAll,
  onSave,
}: SelectAccountsStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Select Accounts</DialogTitle>
        <DialogDescription>Choose which accounts you want to add to Spark.</DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {selectedAccountIds.size} of {accounts.length} selected
          </span>
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            {selectedAccountIds.size === accounts.length ? "Deselect All" : "Select All"}
          </Button>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {accounts.map((account) => (
            <label
              key={account.accountId}
              className="flex cursor-pointer items-center gap-3 border p-3 transition-colors hover:bg-muted"
            >
              <Checkbox
                checked={selectedAccountIds.has(account.accountId)}
                onCheckedChange={() => onToggle(account.accountId)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{account.displayName}</p>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  {formatAccountType(account.accountType) && (
                    <span className="capitalize">{formatAccountType(account.accountType)}</span>
                  )}
                  {formatAccountNumber(account) && (
                    <>
                      <span>-</span>
                      <span>{formatAccountNumber(account)}</span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-muted-foreground text-xs">{account.currency}</span>
            </label>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSave} disabled={selectedAccountIds.size === 0} className="w-full">
          Add {selectedAccountIds.size} Account{selectedAccountIds.size !== 1 ? "s" : ""}
        </Button>
      </DialogFooter>
    </>
  );
}
