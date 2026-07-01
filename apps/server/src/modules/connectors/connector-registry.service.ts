import { Injectable } from "@nestjs/common";
import { ConnectorRegistry } from "@spark/connectors";
import type { ConnectorManifest, FinancialConnector } from "@spark/connectors";

/**
 * Registry over the available connectors. Instantiated via the factory
 * provider in ConnectorsModule so connectors with injected dependencies
 * (e.g. the TrueLayer connector's client + token provider) can register;
 * TASK-007 generalises this into a fully DI-driven registry.
 */
@Injectable()
export class ConnectorRegistryService {
  private readonly registry = new ConnectorRegistry();

  constructor(connectors: readonly FinancialConnector[] = []) {
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
