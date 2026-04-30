import { Module } from "@nestjs/common";
import { CryptoModule } from "../crypto";
import { ConnectorConnectionService } from "./connector-connection.service";
import { ConnectorPersistenceService } from "./connector-persistence.service";
import { ConnectorRegistryService } from "./connector-registry.service";
import { ConnectorSyncService } from "./connector-sync.service";
import { ConnectorsController } from "./connectors.controller";

@Module({
  imports: [CryptoModule],
  controllers: [ConnectorsController],
  providers: [
    ConnectorRegistryService,
    ConnectorPersistenceService,
    ConnectorSyncService,
    ConnectorConnectionService,
  ],
  exports: [
    ConnectorRegistryService,
    ConnectorPersistenceService,
    ConnectorSyncService,
    ConnectorConnectionService,
  ],
})
export class ConnectorsModule {}
