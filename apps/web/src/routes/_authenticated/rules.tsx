import { createFileRoute, redirect } from "@tanstack/react-router";

/** Rules moved into Settings, next to categories; keep old links working. */
export const Route = createFileRoute("/_authenticated/rules")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/rules", replace: true });
  },
});
