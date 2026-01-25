import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Account } from "@spark/orpc/contract";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AccountsAttentionBannerProps {
  accounts: Account[];
  onReauth: (providerId?: string) => void;
}

export function AccountsAttentionBanner({ accounts, onReauth }: AccountsAttentionBannerProps) {
  if (accounts.length === 0) return null;

  const count = accounts.length;
  const displayNames = accounts.slice(0, 3).map((a) => a.displayName);
  const remaining = count - 3;

  const namesText =
    remaining > 0 ? `${displayNames.join(", ")} +${remaining} more` : displayNames.join(", ");

  const firstProviderId = accounts[0]?.provider.providerId;

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/5 gap-1">
      <AlertTitle className="flex items-center gap-2 font-medium text-base">
        <AlertTriangle className="size-5 text-destructive shrink-0" />
        {count} account{count > 1 ? "s" : ""} need{count === 1 ? "s" : ""} attention
      </AlertTitle>

      <AlertDescription className="flex items-center gap-2 justify-between">
        <p className="text-muted-foreground text-sm truncate mb-0!">{namesText}</p>
        <Button variant="destructive" size="sm" onClick={() => onReauth(firstProviderId)}>
          Reconnect
        </Button>
      </AlertDescription>
    </Alert>
  );
}
