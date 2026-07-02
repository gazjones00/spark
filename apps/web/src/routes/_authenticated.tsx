import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { RouteError } from "@/components/route-error";
import { getCurrentUser } from "@/server/auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: AuthenticatedLayout,
  // Boundary for every signed-in page: a child route's render/loader error
  // renders here instead of bubbling to the app root.
  errorComponent: RouteError,
});

function AuthenticatedLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
