import { z } from "zod";

export const ChangePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  })
  .meta({ id: "ChangePasswordInput" });

export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const ChangePasswordResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .meta({ id: "ChangePasswordResponse" });

export type ChangePasswordResponse = z.infer<typeof ChangePasswordResponseSchema>;

export const NotificationPreferencesSchema = z
  .object({
    largeTransactions: z.boolean(),
    lowBalance: z.boolean(),
    budgetOverspend: z.boolean(),
    syncFailures: z.boolean(),
  })
  .meta({ id: "NotificationPreferences" });

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UpdateNotificationPreferencesInputSchema =
  NotificationPreferencesSchema.partial().meta({
    id: "UpdateNotificationPreferencesInput",
  });

export type UpdateNotificationPreferencesInput = z.infer<
  typeof UpdateNotificationPreferencesInputSchema
>;

export const ThemeSchema = z.enum(["system", "light", "dark"]).meta({ id: "Theme" });

export type Theme = z.infer<typeof ThemeSchema>;

export const UserPreferencesSchema = z
  .object({
    displayCurrency: z.string(),
    theme: ThemeSchema,
  })
  .meta({ id: "UserPreferences" });

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UpdateUserPreferencesInputSchema = UserPreferencesSchema.partial().meta({
  id: "UpdateUserPreferencesInput",
});

export type UpdateUserPreferencesInput = z.infer<typeof UpdateUserPreferencesInputSchema>;
