import { Module } from "@nestjs/common";
import { AccountSyncJob } from "./account-sync.job";
import { InitialSyncJob } from "./initial-sync.job";
import { PeriodicSyncJob } from "./periodic-sync.job";
import { BalanceSyncService } from "./services/balance-sync.service";
import { TransactionSyncService } from "./services/transaction-sync.service";

@Module({
  providers: [
    AccountSyncJob,
    InitialSyncJob,
    PeriodicSyncJob,
    BalanceSyncService,
    TransactionSyncService,
  ],
})
export class JobsModule {}
