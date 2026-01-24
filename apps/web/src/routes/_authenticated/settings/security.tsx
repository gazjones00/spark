import { createFileRoute } from "@tanstack/react-router";
import { Security } from "@/features/settings/components/Security";

export const Route = createFileRoute("/_authenticated/settings/security")({
  component: Security,
});
