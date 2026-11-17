import { createFileRoute, redirect } from "@tanstack/react-router";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { getCurrentUser } from "@/server/auth";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthLayout
      title="Create your account"
      description="Free to use. Connect your first bank in about a minute."
    >
      <SignupForm />
    </AuthLayout>
  );
}
