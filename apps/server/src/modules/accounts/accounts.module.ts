import { Module } from "@nestjs/common";
import { ConnectorsModule } from "../connectors";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { BalanceModule } from "./balance";

@Module({
  imports: [BalanceModule, ConnectorsModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService, BalanceModule],
})
export class AccountsModule {}
