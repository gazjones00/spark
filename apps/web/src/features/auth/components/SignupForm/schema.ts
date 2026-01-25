import { z } from "zod";

export const signupSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .transform((v) => v.trim()),
    email: z.email("Please enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupFormData = z.infer<typeof signupSchema>;
