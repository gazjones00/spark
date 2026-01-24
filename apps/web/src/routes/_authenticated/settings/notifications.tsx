import { createFileRoute } from "@tanstack/react-router";
import { Notifications } from "@/features/settings/components/Notifications";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: Notifications,
});
