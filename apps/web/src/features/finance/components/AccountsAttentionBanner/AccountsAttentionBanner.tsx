import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Account } from "@spark/orpc/contract";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AccountsAttentionBannerProps {
  accounts: Account[];
  /** Still syncing fine, but consent is estimated to expire soon. */
  expiringAccounts?: Account[];
  onReauth: (providerId?: string) => void;
}

function accountNames(accounts: Account[]): string {
  const displayNames = accounts.slice(0, 3).map((a) => a.displayName);
  const remaining = accounts.length - 3;
  return remaining > 0 ? `${displayNames.join(", ")} +${remaining} more` : displayNames.join(", ");
}

export function AccountsAttentionBanner({
  accounts,
  expiringAccounts = [],
  onReauth,
}: AccountsAttentionBannerProps) {
  if (accounts.length === 0 && expiringAccounts.length === 0) return null;

  const count = accounts.length;
  const expiringCount = expiringAccounts.length;

  return (
    <div className="space-y-3">
      {count > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5 gap-1">
          <AlertTitle className="flex items-center gap-2 font-medium text-base">
            <AlertTriangle className="size-5 text-destructive shrink-0" />
            {count} account{count > 1 ? "s" : ""} need{count === 1 ? "s" : ""} attention
          </AlertTitle>

          <AlertDescription className="flex items-center gap-2 justify-between">
            <p className="text-muted-foreground text-sm truncate mb-0!">{accountNames(accounts)}</p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onReauth(accounts[0]?.provider.providerId)}
            >
              Reconnect
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {expiringCount > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/5 gap-1">
          <AlertTitle className="flex items-center gap-2 font-medium text-base">
            <Clock className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
            {expiringCount} account{expiringCount > 1 ? "s" : ""} to reconnect soon
          </AlertTitle>

          <AlertDescription className="flex items-center gap-2 justify-between">
            <p className="text-muted-foreground text-sm truncate mb-0!">
              Bank access for {accountNames(expiringAccounts)} expires soon — reconnect anytime to
              keep syncing without interruption.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReauth(expiringAccounts[0]?.provider.providerId)}
            >
              Reconnect
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
