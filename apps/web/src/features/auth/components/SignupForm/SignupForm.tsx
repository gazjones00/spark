import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@spark/auth/react";

import { FormDivider } from "../FormDivider";
import { PasswordInput } from "../PasswordInput";
import { SocialLoginButtons } from "../SocialLoginButtons";
import { signupSchema, type SignupFormData } from "./schema";

export function SignupForm() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: SignupFormData) => {
    const result = await signup(data.name, data.email, data.password);
    if (result.error) {
      form.setError("root", { message: result.error.message });
      return;
    }
    navigate({ to: "/dashboard" });
  };

  const isSubmitting = form.formState.isSubmitting;
  const rootError = form.formState.errors.root;
  const { errors } = form.formState;

  return (
    <div className="grid gap-6">
      <SocialLoginButtons disabled={isSubmitting} />
      <FormDivider />

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {rootError ? (
          <div
            role="alert"
            className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg p-3 text-sm"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {rootError.message}
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Alex Morgan"
            disabled={isSubmitting}
            aria-invalid={errors.name ? true : undefined}
            {...form.register("name")}
          />
          {errors.name ? <p className="text-destructive text-xs">{errors.name.message}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={isSubmitting}
            aria-invalid={errors.email ? true : undefined}
            {...form.register("email")}
          />
          {errors.email ? <p className="text-destructive text-xs">{errors.email.message}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="Create a password"
            disabled={isSubmitting}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="password-hint"
            {...form.register("password")}
          />
          <p
            id="password-hint"
            className={
              errors.password ? "text-destructive text-xs" : "text-muted-foreground text-xs"
            }
          >
            {errors.password?.message ?? "Use 8 or more characters."}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Type it again"
            disabled={isSubmitting}
            aria-invalid={errors.confirmPassword ? true : undefined}
            {...form.register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Creating your account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-primary font-medium underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
