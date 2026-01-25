import { createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthLayout title="Welcome back" description="Sign in to your account to continue">
      <LoginForm />
    </AuthLayout>
  );
}
