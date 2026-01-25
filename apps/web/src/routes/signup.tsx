import { createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { SignupForm } from "@/features/auth/components/SignupForm";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthLayout title="Create an account" description="Enter your details to get started">
      <SignupForm />
    </AuthLayout>
  );
}
