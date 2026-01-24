import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { contract } from "@spark/orpc/contract";
import { SettingsService } from "./settings.service";

@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Implement(contract.settings.getNotificationPreferences)
  getNotificationPreferences(@Session() session: UserSession) {
    return implement(contract.settings.getNotificationPreferences).handler(() => {
      return this.settingsService.getNotificationPreferences(session.user.id);
    });
  }

  @Implement(contract.settings.updateNotificationPreferences)
  updateNotificationPreferences(@Session() session: UserSession) {
    return implement(contract.settings.updateNotificationPreferences).handler(({ input }) => {
      return this.settingsService.updateNotificationPreferences(session.user.id, input);
    });
  }

  @Implement(contract.settings.getUserPreferences)
  getUserPreferences(@Session() session: UserSession) {
    return implement(contract.settings.getUserPreferences).handler(() => {
      return this.settingsService.getUserPreferences(session.user.id);
    });
  }

  @Implement(contract.settings.updateUserPreferences)
  updateUserPreferences(@Session() session: UserSession) {
    return implement(contract.settings.updateUserPreferences).handler(({ input }) => {
      return this.settingsService.updateUserPreferences(session.user.id, input);
    });
  }
}
