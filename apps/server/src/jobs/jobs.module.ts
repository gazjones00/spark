import { Module } from "@nestjs/common";
import { AccountsModule } from "../modules/accounts";
import { AccountSyncJob } from "./account-sync.job";
import { InitialSyncJob } from "./initial-sync.job";
import { PeriodicSyncJob } from "./periodic-sync.job";
import { TransactionSyncService } from "./services/transaction-sync.service";

@Module({
  imports: [AccountsModule],
  providers: [AccountSyncJob, InitialSyncJob, PeriodicSyncJob, TransactionSyncService],
})
export class JobsModule {}
