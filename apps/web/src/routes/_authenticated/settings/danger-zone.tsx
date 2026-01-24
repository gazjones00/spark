import { createFileRoute } from "@tanstack/react-router";
import { DangerZone } from "@/features/settings/components/DangerZone";

export const Route = createFileRoute("/_authenticated/settings/danger-zone")({
  component: DangerZone,
});
