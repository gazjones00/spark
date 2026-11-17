import { createFileRoute, redirect } from "@tanstack/react-router";

/** Connected accounts are managed on the Accounts page; keep old links working. */
export const Route = createFileRoute("/_authenticated/settings/accounts")({
  beforeLoad: () => {
    throw redirect({ to: "/accounts", replace: true });
  },
});
