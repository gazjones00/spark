import { Module } from "@nestjs/common";
import { AccountsModule } from "../modules/accounts";
import { ConnectorsModule } from "../modules/connectors";
import { TransactionsModule } from "../modules/transactions";
import { AccountSyncJob } from "./account-sync.job";
import { ConnectorSyncJob } from "./connector-sync.job";
import { InitialSyncJob } from "./initial-sync.job";
import { PeriodicSyncJob } from "./periodic-sync.job";

@Module({
  imports: [AccountsModule, ConnectorsModule, TransactionsModule],
  providers: [AccountSyncJob, ConnectorSyncJob, InitialSyncJob, PeriodicSyncJob],
})
export class JobsModule {}
