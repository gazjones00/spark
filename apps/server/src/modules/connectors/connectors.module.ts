import { Module, type Provider } from "@nestjs/common";
import type { FinancialConnector } from "@spark/connectors";
import { Trading212Connector, TrueLayerConnector } from "@spark/connectors";
import { env } from "@spark/env/server";
import { CryptoModule } from "../crypto";
import { EnrichmentModule } from "../enrichment";
import { ConnectorConnectionService } from "./connector-connection.service";
import { ConnectorPersistenceService } from "./connector-persistence.service";
import { ConnectorRegistryService } from "./connector-registry.service";
import { ConnectorSyncService } from "./connector-sync.service";
import { CONNECTORS } from "./connector.tokens";
import { ConnectorsController } from "./connectors.controller";
import { DailyBalanceService } from "./daily-balance.service";
import {
  TruelayerClient,
  TruelayerConnectorTokenService,
  TruelayerController,
  TruelayerService,
  truelayerConfigProvider,
} from "./truelayer";

// Each connector is its own provider so it can receive injected
// dependencies (the TrueLayer connector needs the client + token provider
// below). To add a provider: register it here and append it to the
// CONNECTORS inject list — the registry never changes.
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

// TrueLayer's server side: the API client and the connector's token
// provider, plus the OAuth connect flow (the REST callback is the documented
// exception to oRPC in docs/adr/0001, since oRPC cannot serve a redirect).
const truelayerProviders: Provider[] = [
  truelayerConfigProvider,
  TruelayerClient,
  TruelayerConnectorTokenService,
  TruelayerService,
];

@Module({
  imports: [CryptoModule, EnrichmentModule],
  controllers: [ConnectorsController, TruelayerController],
  providers: [
    ...truelayerProviders,
    ...connectorProviders,
    ConnectorRegistryService,
    ConnectorPersistenceService,
    ConnectorSyncService,
    ConnectorConnectionService,
    DailyBalanceService,
  ],
  exports: [
    ConnectorRegistryService,
    ConnectorPersistenceService,
    ConnectorSyncService,
    ConnectorConnectionService,
    DailyBalanceService,
  ],
})
export class ConnectorsModule {}
