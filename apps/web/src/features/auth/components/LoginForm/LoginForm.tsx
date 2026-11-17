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
import { loginSchema, type LoginFormData } from "./schema";

export function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    const result = await login(data.email, data.password);
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
            autoComplete="current-password"
            placeholder="Your password"
            disabled={isSubmitting}
            aria-invalid={errors.password ? true : undefined}
            {...form.register("password")}
          />
          {errors.password ? (
            <p className="text-destructive text-xs">{errors.password.message}</p>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        New to Spark?{" "}
        <Link to="/signup" className="text-primary font-medium underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
