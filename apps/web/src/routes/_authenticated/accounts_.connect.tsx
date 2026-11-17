import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { ConnectAccountFlow } from "@/features/finance/components/ConnectAccount";

const searchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  /** Set when the API redirects a cancelled or refused consent back here. */
  error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/accounts_/connect")({
  component: ConnectAccountPage,
  validateSearch: searchSchema,
});

function ConnectAccountPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Connect an account"
        description="Link a bank account or credit card securely."
      />
      <ConnectAccountFlow onDone={() => navigate({ to: "/dashboard" })} />
    </div>
  );
}
