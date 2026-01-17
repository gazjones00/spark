import { Module } from "@nestjs/common";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { BalanceModule } from "./balance";

@Module({
  imports: [BalanceModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService, BalanceModule],
})
export class AccountsModule {}
