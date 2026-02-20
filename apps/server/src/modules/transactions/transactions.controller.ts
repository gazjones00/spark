import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { contract } from "@spark/orpc/contract";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { TransactionsService } from "./transactions.service";

@Controller()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Implement(contract.transactions.list)
  list(@Session() session: UserSession) {
    return implement(contract.transactions.list).handler(() => {
      return this.transactionsService.list(session.user.id);
    });
  }
}
