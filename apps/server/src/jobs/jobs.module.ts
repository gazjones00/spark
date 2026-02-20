import { Module } from "@nestjs/common";
import { AccountsModule } from "../modules/accounts";
import { TransactionsModule } from "../modules/transactions";
import { AccountSyncJob } from "./account-sync.job";
import { InitialSyncJob } from "./initial-sync.job";
import { PeriodicSyncJob } from "./periodic-sync.job";

@Module({
  imports: [AccountsModule, TransactionsModule],
  providers: [AccountSyncJob, InitialSyncJob, PeriodicSyncJob],
})
export class JobsModule {}
