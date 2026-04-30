import type { FinancialConnector } from "./connector.ts";
import type { ConnectorManifest } from "./manifest.ts";

export class ConnectorRegistry {
  private readonly connectors = new Map<string, FinancialConnector>();

  register(connector: FinancialConnector): void {
    this.connectors.set(connector.manifest.id, connector);
  }

  get(providerId: string): FinancialConnector | undefined {
    return this.connectors.get(providerId);
  }

  require(providerId: string): FinancialConnector {
    const connector = this.get(providerId);
    if (!connector) {
      throw new Error(`Connector '${providerId}' is not registered.`);
    }
    return connector;
  }

  listManifests(): ConnectorManifest[] {
    return Array.from(this.connectors.values()).map((connector) => connector.manifest);
  }
}
