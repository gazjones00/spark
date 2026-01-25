import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@spark/auth/react";

import { FormDivider } from "../FormDivider";
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
      {rootError && (
        <div className="bg-destructive/10 text-destructive rounded-none p-3 text-sm">
          {rootError.message}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="john@example.com"
          disabled={isSubmitting}
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            to="/login"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          disabled={isSubmitting}
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>

      <FormDivider />
      <SocialLoginButtons disabled={isSubmitting} />

      <p className="text-muted-foreground text-center text-sm">
        Don't have an account?{" "}
        <Link to="/signup" className="text-foreground underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
