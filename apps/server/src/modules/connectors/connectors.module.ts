import { Module, type Provider } from "@nestjs/common";
import type { FinancialConnector } from "@spark/connectors";
import { Trading212Connector, TrueLayerConnector } from "@spark/connectors";
import { env } from "@spark/env/server";
import { TruelayerClient } from "../../providers/truelayer/truelayer.client";
import { TruelayerConnectorTokenService } from "../../providers/truelayer/truelayer-connector-token.service";
import { CryptoModule } from "../crypto";
import { ConnectorConnectionService } from "./connector-connection.service";
import { ConnectorPersistenceService } from "./connector-persistence.service";
import { ConnectorRegistryService } from "./connector-registry.service";
import { ConnectorSyncService } from "./connector-sync.service";
import { CONNECTORS } from "./connector.tokens";
import { ConnectorsController } from "./connectors.controller";

// Each connector is its own provider so it can receive injected
// dependencies (the TrueLayer connector needs the client + token provider
// from the global TruelayerModule). To add a provider: register it here
// and append it to the CONNECTORS inject list — the registry never changes.
const connectorProviders: Provider[] = [
  {
    provide: Trading212Connector,
    useFactory: () => new Trading212Connector({ timeoutMs: env.PROVIDER_HTTP_TIMEOUT_MS }),
  },
  {
    provide: TrueLayerConnector,
    useFactory: (client: TruelayerClient, tokenProvider: TruelayerConnectorTokenService) =>
      new TrueLayerConnector({ client, tokenProvider }),
    inject: [TruelayerClient, TruelayerConnectorTokenService],
  },
  {
    provide: CONNECTORS,
    useFactory: (...connectors: FinancialConnector[]) => connectors,
    inject: [Trading212Connector, TrueLayerConnector],
  },
];

@Module({
  imports: [CryptoModule],
  controllers: [ConnectorsController],
  providers: [
    ...connectorProviders,
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
