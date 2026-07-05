import { Module } from "@nestjs/common";
import { AccountsModule } from "../modules/accounts";
import { ConnectorsModule } from "../modules/connectors";
import { EnrichmentModule } from "../modules/enrichment";
import { TransactionsModule } from "../modules/transactions";
import { AccountSyncJob } from "./account-sync.job";
import { ConsentLifecycleJob } from "./consent-lifecycle.job";
import { ConnectorPeriodicSyncJob } from "./connector-periodic-sync.job";
import { ConnectorSyncJob } from "./connector-sync.job";
import { EnrichmentReapplyJob } from "./enrichment-reapply.job";
import { InitialSyncJob } from "./initial-sync.job";
import { OauthStateCleanupJob } from "./oauth-state-cleanup.job";
import { PeriodicSyncJob } from "./periodic-sync.job";

@Module({
  imports: [AccountsModule, ConnectorsModule, EnrichmentModule, TransactionsModule],
  providers: [
    AccountSyncJob,
    ConsentLifecycleJob,
    ConnectorPeriodicSyncJob,
    ConnectorSyncJob,
    EnrichmentReapplyJob,
    InitialSyncJob,
    OauthStateCleanupJob,
    PeriodicSyncJob,
  ],
})
export class JobsModule {}
