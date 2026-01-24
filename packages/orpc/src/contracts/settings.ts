import { oc } from "@orpc/contract";
import { z } from "zod";

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export const ChangePasswordResponseSchema = z.object({
  success: z.boolean(),
});

export const NotificationPreferencesSchema = z.object({
  largeTransactions: z.boolean(),
  lowBalance: z.boolean(),
  budgetOverspend: z.boolean(),
  syncFailures: z.boolean(),
});

export const UpdateNotificationPreferencesInputSchema = z.object({
  largeTransactions: z.boolean().optional(),
  lowBalance: z.boolean().optional(),
  budgetOverspend: z.boolean().optional(),
  syncFailures: z.boolean().optional(),
});

export const ThemeSchema = z.enum(["system", "light", "dark"]);

export const UserPreferencesSchema = z.object({
  displayCurrency: z.string(),
  theme: ThemeSchema,
});

export const UpdateUserPreferencesInputSchema = z.object({
  displayCurrency: z.string().optional(),
  theme: ThemeSchema.optional(),
});

export const settingsRouter = oc.router({
  getNotificationPreferences: oc
    .route({
      method: "GET",
      path: "/settings/notifications",
    })
    .output(NotificationPreferencesSchema),

  updateNotificationPreferences: oc
    .route({
      method: "PATCH",
      path: "/settings/notifications",
    })
    .input(UpdateNotificationPreferencesInputSchema)
    .output(NotificationPreferencesSchema),

  getUserPreferences: oc
    .route({
      method: "GET",
      path: "/settings/preferences",
    })
    .output(UserPreferencesSchema),

  updateUserPreferences: oc
    .route({
      method: "PATCH",
      path: "/settings/preferences",
    })
    .input(UpdateUserPreferencesInputSchema)
    .output(UserPreferencesSchema),
});
