import { Module } from "@nestjs/common";
import { ConnectorsModule } from "../modules/connectors";
import { EnrichmentModule } from "../modules/enrichment";
import { ConsentLifecycleJob } from "./consent-lifecycle.job";
import { ConnectorPeriodicSyncJob } from "./connector-periodic-sync.job";
import { ConnectorSyncJob } from "./connector-sync.job";
import { EnrichmentReapplyJob } from "./enrichment-reapply.job";
import { OauthStateCleanupJob } from "./oauth-state-cleanup.job";

@Module({
  imports: [ConnectorsModule, EnrichmentModule],
  providers: [
    ConsentLifecycleJob,
    ConnectorPeriodicSyncJob,
    ConnectorSyncJob,
    EnrichmentReapplyJob,
    OauthStateCleanupJob,
  ],
})
export class JobsModule {}
