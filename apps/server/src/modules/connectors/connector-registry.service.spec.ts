import { Trading212Connector } from "@spark/connectors";
import { describe, expect, it } from "vitest";
import { ConnectorRegistryService } from "./connector-registry.service";

describe("ConnectorRegistryService", () => {
  it("registers injected connectors and lists their manifests", () => {
    const connector = new Trading212Connector();
    const registry = new ConnectorRegistryService([connector]);

    expect(registry.listManifests()).toEqual([connector.manifest]);
    expect(registry.get(connector.manifest.id)).toBe(connector);
    expect(registry.require(connector.manifest.id)).toBe(connector);
  });

  it("tolerates an empty connector set", () => {
    expect(() => new ConnectorRegistryService()).not.toThrow();
    expect(new ConnectorRegistryService().listManifests()).toEqual([]);
  });

  it("require throws for unknown providers", () => {
    const registry = new ConnectorRegistryService([]);
    expect(registry.get("unknown")).toBeUndefined();
    expect(() => registry.require("unknown")).toThrow("not registered");
  });
});
