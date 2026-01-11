import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectAccountModal } from "@/features/finance/components/connect-account-modal";

const searchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/accounts/connect")({
  component: ConnectAccountPage,
  validateSearch: searchSchema,
});

function ConnectAccountPage() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate({ to: "/accounts" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connect Account</h1>
        <p className="text-muted-foreground text-sm">Securely link your bank accounts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a Bank Account</CardTitle>
          <CardDescription>
            Connect your bank account using Open Banking to automatically import your transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectAccountModal
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Connect Bank Account
              </Button>
            }
            onSuccess={handleSuccess}
          />
        </CardContent>
      </Card>
    </div>
  );
}
