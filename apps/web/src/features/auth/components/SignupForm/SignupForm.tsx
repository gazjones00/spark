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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
      {rootError && (
        <div className="bg-destructive/10 text-destructive rounded-none p-3 text-sm">
          {rootError.message}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="John Doe"
          disabled={isSubmitting}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
        )}
      </div>

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
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Create a password"
          disabled={isSubmitting}
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          disabled={isSubmitting}
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-destructive text-xs">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create account"
        )}
      </Button>

      <FormDivider />
      <SocialLoginButtons disabled={isSubmitting} />

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
