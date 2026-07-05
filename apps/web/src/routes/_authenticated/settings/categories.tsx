import { createFileRoute } from "@tanstack/react-router";
import { Categories } from "@/features/settings/components/Categories";

export const Route = createFileRoute("/_authenticated/settings/categories")({
  component: Categories,
});
