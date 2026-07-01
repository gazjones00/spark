import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConnectorRegistry } from "@spark/connectors";
import type { ConnectorManifest, FinancialConnector } from "@spark/connectors";
import { CONNECTORS } from "./connector.tokens";

/**
 * Registry over the connectors registered under the CONNECTORS token in
 * ConnectorsModule. Each connector is a DI provider, so connectors with
 * dependencies (e.g. the TrueLayer connector's client + token provider)
 * receive them through the container.
 */
@Injectable()
export class ConnectorRegistryService {
  private readonly registry = new ConnectorRegistry();

  constructor(@Optional() @Inject(CONNECTORS) connectors: readonly FinancialConnector[] = []) {
    for (const connector of connectors) {
      this.registry.register(connector);
    }
  }

  listManifests(): ConnectorManifest[] {
    return this.registry.listManifests();
  }

  get(providerId: string): FinancialConnector | undefined {
    return this.registry.get(providerId);
  }

  require(providerId: string): FinancialConnector {
    return this.registry.require(providerId);
  }
}
