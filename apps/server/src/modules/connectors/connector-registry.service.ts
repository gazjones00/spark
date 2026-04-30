import { Injectable } from "@nestjs/common";
import { ConnectorRegistry, Trading212Connector } from "@spark/connectors";
import type { ConnectorManifest, FinancialConnector } from "@spark/connectors";

@Injectable()
export class ConnectorRegistryService {
  private readonly registry = new ConnectorRegistry();

  constructor() {
    this.registry.register(new Trading212Connector());
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
