import { createFileRoute } from "@tanstack/react-router";
import { Preferences } from "@/features/settings/components/Preferences";

export const Route = createFileRoute("/_authenticated/settings/preferences")({
  component: Preferences,
});
