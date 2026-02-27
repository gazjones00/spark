import { oc } from "@orpc/contract";
import {
  NotificationPreferencesSchema,
  UpdateNotificationPreferencesInputSchema,
  UpdateUserPreferencesInputSchema,
  UserPreferencesSchema,
} from "@spark/schema";

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
