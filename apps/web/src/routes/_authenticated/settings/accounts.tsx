import { createFileRoute } from "@tanstack/react-router";
import { ConnectedAccounts } from "@/features/settings/components/ConnectedAccounts";

export const Route = createFileRoute("/_authenticated/settings/accounts")({
  component: ConnectedAccounts,
});
