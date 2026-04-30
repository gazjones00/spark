import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  FinancialAccountType,
  type FinancialConnector,
  TRADING212_MANIFEST,
  TRADING212_PROVIDER_ID,
} from "@spark/connectors";
import { chainMock, createMockDb } from "@spark/testing";
import { describe, expect, it, vi } from "vitest";
import { CryptoService } from "../crypto";
import { Jobs } from "../message-queue";
import type { MessageQueueService } from "../message-queue";
import { ConnectorConnectionService } from "./connector-connection.service";
import { ConnectorRegistryService } from "./connector-registry.service";
import { ConnectorSyncService } from "./connector-sync.service";

function createService() {
  const connector = {
    manifest: TRADING212_MANIFEST,
    testConnection: vi.fn(),
    sync: vi.fn(),
  } as unknown as FinancialConnector;
  const registry = {
    get: vi.fn<ConnectorRegistryService["get"]>(() => connector),
  };
  const syncService = {
    testConnection: vi.fn(async () => undefined),
  };
  const cryptoService = {
    getCurrentKeyId: vi.fn(() => "key-1"),
    encryptToString: vi.fn(async () => "encrypted-credentials"),
  };
  const queue = {
    add: vi.fn(async () => undefined),
  };
  const db = createMockDb();

  const service = new ConnectorConnectionService(
    registry as unknown as ConnectorRegistryService,
    syncService as unknown as ConnectorSyncService,
    cryptoService as unknown as CryptoService,
    queue as unknown as MessageQueueService,
    db as never,
  );

  return { service, registry, syncService, cryptoService, queue, db };
}

describe("ConnectorConnectionService", () => {
  it("returns a 404 for unknown connector providers", async () => {
    const { service, registry, syncService } = createService();
    registry.get.mockReturnValue(undefined);

    await expect(
      service.testConnection({
        userId: "user-1",
        providerId: "unknown-provider",
        environment: "live",
        credentials: { apiKey: "key", apiSecret: "secret" },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(syncService.testConnection).not.toHaveBeenCalled();
  });

  it("rejects unsupported credential fields before verification", async () => {
    const { service, syncService } = createService();

    await expect(
      service.testConnection({
        userId: "user-1",
        providerId: TRADING212_PROVIDER_ID,
        environment: "live",
        credentials: { apiKey: "key", apiSecret: "secret", accessToken: "extra" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(syncService.testConnection).not.toHaveBeenCalled();
  });

  it("verifies and stores only manifest-declared credentials", async () => {
    const { service, syncService, cryptoService, queue, db } = createService();
    const createdAt = new Date("2026-01-30T10:00:00Z");
    const row = {
      id: "connection-1",
      userId: "user-1",
      providerId: TRADING212_PROVIDER_ID,
      providerName: TRADING212_MANIFEST.displayName,
      environment: "demo",
      encryptedCredentials: "encrypted-credentials",
      credentialKeyId: "key-1",
      capabilities: [...TRADING212_MANIFEST.capabilities],
      metadata: { accountType: FinancialAccountType.StocksIsa },
      lastSyncedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    const chain = chainMock(row);
    db.insert.mockReturnValue(chain);

    const result = await service.createConnection({
      userId: "user-1",
      providerId: TRADING212_PROVIDER_ID,
      environment: "demo",
      credentials: { apiKey: "key", apiSecret: "secret" },
      connectionOptions: { accountType: FinancialAccountType.StocksIsa },
    });

    const expectedCredentials = { apiKey: "key", apiSecret: "secret" };
    expect(syncService.testConnection).toHaveBeenCalledWith({
      providerId: TRADING212_PROVIDER_ID,
      environment: "demo",
      userId: "user-1",
      credentials: expectedCredentials,
      metadata: { accountType: FinancialAccountType.StocksIsa },
    });
    expect(cryptoService.encryptToString).toHaveBeenCalledWith(
      JSON.stringify(expectedCredentials),
      "key-1",
    );
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: TRADING212_PROVIDER_ID,
        encryptedCredentials: "encrypted-credentials",
        credentialKeyId: "key-1",
      }),
    );
    expect(result).toMatchObject({
      id: "connection-1",
      providerId: TRADING212_PROVIDER_ID,
      environment: "demo",
      metadata: { accountType: FinancialAccountType.StocksIsa },
    });
    expect(queue.add).toHaveBeenCalledWith(
      Jobs.ConnectorSync,
      expect.objectContaining({
        connectionId: "connection-1",
        userId: "user-1",
      }),
      expect.objectContaining({
        jobId: "connector:connection-1:initial",
        attempts: 3,
      }),
    );
  });

  it("lists user connections without exposing encrypted credentials", async () => {
    const { service, db } = createService();
    const createdAt = new Date("2026-01-30T10:00:00Z");
    const row = {
      id: "connection-1",
      userId: "user-1",
      providerId: TRADING212_PROVIDER_ID,
      providerName: TRADING212_MANIFEST.displayName,
      environment: "live",
      encryptedCredentials: "encrypted-credentials",
      credentialKeyId: "key-1",
      capabilities: [...TRADING212_MANIFEST.capabilities],
      metadata: { accountType: FinancialAccountType.Invest },
      lastSyncedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([row]),
    };
    (db as unknown as { select: ReturnType<typeof vi.fn> }).select = vi.fn(() => chain);

    const result = await service.listConnections("user-1");

    expect(result).toEqual([
      {
        id: "connection-1",
        providerId: TRADING212_PROVIDER_ID,
        providerName: TRADING212_MANIFEST.displayName,
        environment: "live",
        capabilities: [...TRADING212_MANIFEST.capabilities],
        metadata: { accountType: FinancialAccountType.Invest },
        lastSyncedAt: null,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("encrypted-credentials");
    expect(chain.where).toHaveBeenCalledOnce();
  });

  it("deletes a connection scoped to the current user", async () => {
    const { service, db } = createService();
    const chain = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "connection-1" }]),
    };
    (db as unknown as { delete: ReturnType<typeof vi.fn> }).delete = vi.fn(() => chain);

    await expect(service.deleteConnection("user-1", "connection-1")).resolves.toBeUndefined();

    expect(chain.where).toHaveBeenCalledOnce();
    expect(chain.returning).toHaveBeenCalledOnce();
  });

  it("returns a 404 when deleting a missing connection", async () => {
    const { service, db } = createService();
    const chain = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    (db as unknown as { delete: ReturnType<typeof vi.fn> }).delete = vi.fn(() => chain);

    await expect(service.deleteConnection("user-1", "missing-connection")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
