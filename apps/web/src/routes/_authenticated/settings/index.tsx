import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "@/features/settings/components/Profile";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: Profile,
});
