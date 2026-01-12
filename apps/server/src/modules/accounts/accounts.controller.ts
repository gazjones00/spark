import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { contract } from "@spark/orpc/contract";
import { AccountsService } from "./accounts.service";

@Controller()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Implement(contract.accounts.list)
  list(@Session() session: UserSession) {
    return implement(contract.accounts.list).handler(() => {
      return this.accountsService.list(session.user.id);
    });
  }

  @Implement(contract.accounts.update)
  update(@Session() session: UserSession) {
    return implement(contract.accounts.update).handler(({ input }) => {
      return this.accountsService.update(session.user.id, input);
    });
  }

  @Implement(contract.accounts.delete)
  delete(@Session() session: UserSession) {
    return implement(contract.accounts.delete).handler(({ input }) => {
      return this.accountsService.delete(session.user.id, input.id);
    });
  }
}
