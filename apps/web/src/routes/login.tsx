import { createFileRoute, redirect } from "@tanstack/react-router";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getCurrentUser } from "@/server/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthLayout title="Welcome back" description="Sign in to see where your money is today.">
      <LoginForm />
    </AuthLayout>
  );
}
