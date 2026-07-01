import { Module } from "@nestjs/common";
import { Trading212Connector, TrueLayerConnector } from "@spark/connectors";
import { TruelayerClient } from "../../providers/truelayer/truelayer.client";
import { TruelayerConnectorTokenService } from "../../providers/truelayer/truelayer-connector-token.service";
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
    {
      // The TrueLayer connector has injected dependencies (client + token
      // provider, both provided by the global TruelayerModule), so the
      // registry is built via a factory rather than bare constructors.
      provide: ConnectorRegistryService,
      useFactory: (
        truelayerClient: TruelayerClient,
        tokenService: TruelayerConnectorTokenService,
      ) =>
        new ConnectorRegistryService([
          new Trading212Connector(),
          new TrueLayerConnector({ client: truelayerClient, tokenProvider: tokenService }),
        ]),
      inject: [TruelayerClient, TruelayerConnectorTokenService],
    },
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
