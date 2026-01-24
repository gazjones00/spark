import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, RefreshCw, Plus } from "lucide-react";
import { formatRelative } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { orpc } from "@spark/orpc";

export function ConnectedAccounts() {
  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => orpc.accounts.list.call({}),
  });

  const accounts = data?.accounts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Connected Accounts</h2>
          <p className="text-muted-foreground text-sm">
            Manage your connected bank accounts and sync status
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          render={<Link to="/accounts/connect" />}
        >
          <Plus className="size-4" />
          Connect
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="text-center">
            <RefreshCw className="text-muted-foreground mx-auto size-5 animate-spin" />
            <p className="text-muted-foreground mt-2 text-sm">Loading accounts...</p>
          </CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="text-center">
            <p className="text-muted-foreground text-sm">No accounts connected yet.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              render={<Link to="/accounts/connect" />}
            >
              <Plus className="size-4" />
              Connect your first account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex size-10 items-center justify-center rounded-none">
                    {account.provider.logoUri ? (
                      <img
                        src={account.provider.logoUri}
                        alt={account.provider.displayName}
                        className="size-5"
                      />
                    ) : (
                      <ExternalLink className="text-muted-foreground size-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{account.displayName}</p>
                    <p className="text-muted-foreground text-xs">
                      {account.provider.displayName}
                      {account.balanceUpdatedAt && (
                        <>
                          {" "}
                          &middot; Last synced:{" "}
                          {formatRelative(new Date(account.balanceUpdatedAt), new Date())}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <Badge variant={account.balanceUpdatedAt ? "default" : "secondary"}>
                  {account.balanceUpdatedAt ? "Synced" : "Pending"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
