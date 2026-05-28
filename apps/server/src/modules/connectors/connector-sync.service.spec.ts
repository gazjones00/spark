import { ConnectorError, type ConnectorSyncResult } from "@spark/connectors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CryptoService } from "../crypto";
import type { ConnectorPersistenceService } from "./connector-persistence.service";
import type { ConnectorRegistryService } from "./connector-registry.service";
import { ConnectorSyncService } from "./connector-sync.service";

const CONNECTION_ROW = {
  id: "connection-1",
  userId: "user-1",
  providerId: "trading212",
  environment: "live",
  encryptedCredentials: "encrypted",
  credentialKeyId: "key-1",
  metadata: {},
};

function createService() {
  // loadConnection: select().from().where().limit(1) → [row]
  const loadConnectionChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([CONNECTION_ROW]),
  };
  // loadCursors: select().from().where() → []
  const loadCursorsChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  const db = {
    select: vi.fn().mockReturnValueOnce(loadConnectionChain).mockReturnValueOnce(loadCursorsChain),
  };

  const connector = { sync: vi.fn() };
  const registry = { require: vi.fn(() => connector) };
  const persistence = {
    persistSyncResult: vi.fn(async (_input: unknown) => ({
      syncRunId: "run-1",
      recordsRead: 0,
      recordsWritten: 0,
    })),
  };
  const cryptoService = {
    decryptFromString: vi.fn(async () => JSON.stringify({ apiKey: "key", apiSecret: "secret" })),
  };

  const service = new ConnectorSyncService(
    cryptoService as unknown as CryptoService,
    registry as unknown as ConnectorRegistryService,
    persistence as unknown as ConnectorPersistenceService,
    db as never,
  );

  return { service, connector, registry, persistence, cryptoService, db };
}

describe("ConnectorSyncService.syncConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists the failed result AND re-throws so BullMQ can retry", async () => {
    const { service, connector, persistence } = createService();
    const failure = new ConnectorError("token expired", "CONNECTOR_AUTH_ERROR");
    connector.sync.mockRejectedValue(failure);

    await expect(service.syncConnection({ connectionId: "connection-1" })).rejects.toBe(failure);

    expect(persistence.persistSyncResult).toHaveBeenCalledTimes(1);
    const call = persistence.persistSyncResult.mock.calls[0]?.[0] as {
      connectionId: string;
      result: ConnectorSyncResult;
    };
    expect(call.connectionId).toBe("connection-1");
    expect(call.result.status).toBe("failed");
    expect(call.result.errors[0]?.code).toBe("CONNECTOR_AUTH_ERROR");
  });

  it("persists the success result without throwing on the happy path", async () => {
    const { service, connector, persistence } = createService();
    const successResult = {
      status: "success",
      providerId: "trading212",
      connectionId: "connection-1",
      errors: [],
    } as unknown as ConnectorSyncResult;
    connector.sync.mockResolvedValue(successResult);

    const result = await service.syncConnection({ connectionId: "connection-1" });

    expect(result.syncResult).toBe(successResult);
    expect(persistence.persistSyncResult).toHaveBeenCalledTimes(1);
    const persistedCall = persistence.persistSyncResult.mock.calls[0]?.[0] as {
      result: ConnectorSyncResult;
    };
    expect(persistedCall.result).toBe(successResult);
  });
});
