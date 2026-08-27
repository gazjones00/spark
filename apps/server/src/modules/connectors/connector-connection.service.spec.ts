import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  ConnectorAuthError,
  FinancialAccountType,
  type FinancialConnector,
  TRADING212_MANIFEST,
  TRADING212_PROVIDER_ID,
  TRUELAYER_MANIFEST,
  TRUELAYER_PROVIDER_ID,
} from "@spark/connectors";
import { chainMock, createMockDb } from "@spark/testing";
import { describe, expect, it, vi } from "vitest";
import type { CryptoService } from "../crypto";
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
    decryptFromString: vi.fn(async () => "{}"),
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
      syncStatus: "OK",
      lastSyncedAt: null,
      nextSyncAt: createdAt,
      lastSyncErrorCode: null,
      lastSyncErrorMessage: null,
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
      syncStatus: "OK",
      lastSyncedAt: null,
      nextSyncAt: createdAt,
      lastSyncErrorCode: null,
      lastSyncErrorMessage: null,
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
        syncStatus: "OK",
        lastSyncedAt: null,
        nextSyncAt: createdAt,
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("encrypted-credentials");
    expect(chain.where).toHaveBeenCalledOnce();
  });

  it("deletes a connection scoped to the current user without revoking API-key providers", async () => {
    const { service, db, registry, cryptoService } = createService();
    const { selectChain, deleteChain } = mockDeleteChains(db, [
      makeConnectionRow({ providerId: TRADING212_PROVIDER_ID }),
    ]);

    await expect(service.deleteConnection("user-1", "connection-1")).resolves.toBeUndefined();

    expect(selectChain.where).toHaveBeenCalledOnce();
    expect(deleteChain.where).toHaveBeenCalledOnce();
    // Trading 212 is API-key based: no grant exists, so nothing is decrypted
    // and no upstream call is attempted.
    expect(registry.get("trading212")?.revoke).toBeUndefined();
    expect(cryptoService.decryptFromString).not.toHaveBeenCalled();
  });

  it("returns a 404 when deleting a missing connection", async () => {
    const { service, db } = createService();
    const { deleteChain } = mockDeleteChains(db, []);

    await expect(service.deleteConnection("user-1", "missing-connection")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(deleteChain.where).not.toHaveBeenCalled();
  });

  it("revokes the upstream grant with decrypted credentials before deleting", async () => {
    const { service, db, registry, cryptoService } = createService();
    const revoke = vi.fn(async () => undefined);
    registry.get.mockReturnValue({
      manifest: TRADING212_MANIFEST,
      testConnection: vi.fn(),
      sync: vi.fn(),
      revoke,
    } as unknown as FinancialConnector);
    cryptoService.decryptFromString.mockResolvedValue(
      JSON.stringify({ accessToken: "live-token", expiresAt: "2027-01-01T00:00:00.000Z" }),
    );
    const { deleteChain } = mockDeleteChains(db, [
      makeConnectionRow({ metadata: { accountIds: ["acc-1"] } }),
    ]);

    await service.deleteConnection("user-1", "connection-1");

    expect(revoke).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: "connection-1",
        userId: "user-1",
        credentials: { accessToken: "live-token", expiresAt: "2027-01-01T00:00:00.000Z" },
        metadata: { accountIds: ["acc-1"] },
      }),
    );
    expect(deleteChain.where).toHaveBeenCalledOnce();
  });

  it("still deletes locally when upstream revocation fails", async () => {
    const { service, db, registry, cryptoService } = createService();
    registry.get.mockReturnValue({
      manifest: TRADING212_MANIFEST,
      testConnection: vi.fn(),
      sync: vi.fn(),
      revoke: vi.fn(async () => {
        throw new Error("TrueLayer request failed: 500");
      }),
    } as unknown as FinancialConnector);
    cryptoService.decryptFromString.mockResolvedValue(
      JSON.stringify({ accessToken: "live-token", expiresAt: "2027-01-01T00:00:00.000Z" }),
    );
    const { deleteChain } = mockDeleteChains(db, [makeConnectionRow()]);

    await expect(service.deleteConnection("user-1", "connection-1")).resolves.toBeUndefined();
    expect(deleteChain.where).toHaveBeenCalledOnce();
  });

  it("treats an already-revoked grant as success and deletes locally", async () => {
    const { service, db, registry, cryptoService } = createService();
    registry.get.mockReturnValue({
      manifest: TRADING212_MANIFEST,
      testConnection: vi.fn(),
      sync: vi.fn(),
      revoke: vi.fn(async () => {
        throw new ConnectorAuthError("grant already revoked");
      }),
    } as unknown as FinancialConnector);
    cryptoService.decryptFromString.mockResolvedValue(
      JSON.stringify({ accessToken: "stale-token", expiresAt: "2020-01-01T00:00:00.000Z" }),
    );
    const { deleteChain } = mockDeleteChains(db, [makeConnectionRow()]);

    await expect(service.deleteConnection("user-1", "connection-1")).resolves.toBeUndefined();
    expect(deleteChain.where).toHaveBeenCalledOnce();
  });

  it("rotates a re-authorised grant onto the connection it renews", async () => {
    const { service, registry, syncService, cryptoService, queue, db } = createService();
    registry.get.mockReturnValue({
      manifest: TRUELAYER_MANIFEST,
      testConnection: vi.fn(),
      sync: vi.fn(),
    } as unknown as FinancialConnector);
    const row = makeConnectionRow({
      providerId: TRUELAYER_PROVIDER_ID,
      providerName: TRUELAYER_MANIFEST.displayName,
      environment: "production",
      capabilities: [...TRUELAYER_MANIFEST.capabilities],
      metadata: { accountIds: ["acc-1"] },
    });
    const chain = chainMock(row);
    db.update.mockReturnValue(chain);

    const credentials = { accessToken: "fresh-token", refreshToken: "fresh-refresh" };
    const result = await service.reconnectOAuthConnection({
      connectionId: "connection-1",
      userId: "user-1",
      providerId: TRUELAYER_PROVIDER_ID,
      environment: "production",
      credentials,
      metadata: { accountIds: ["acc-1"] },
    });

    expect(syncService.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({ credentials, metadata: { accountIds: ["acc-1"] } }),
    );
    expect(cryptoService.encryptToString).toHaveBeenCalledWith(
      JSON.stringify(credentials),
      "key-1",
    );
    // No insert: the row keeps its id, so its accounts and history survive.
    expect(db.insert).not.toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedCredentials: "encrypted-credentials",
        credentialKeyId: "key-1",
        metadata: { accountIds: ["acc-1"] },
        syncStatus: "OK",
        consecutiveFailures: 0,
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
        consentWarningIssuedAt: null,
      }),
    );
    expect(result).toMatchObject({ id: "connection-1", metadata: { accountIds: ["acc-1"] } });
    // A `:initial` job id would collide with the original connect's completed
    // job and silently drop this sync.
    expect(queue.add).toHaveBeenCalledWith(
      Jobs.ConnectorSync,
      expect.objectContaining({ connectionId: "connection-1", userId: "user-1" }),
      expect.objectContaining({
        jobId: expect.stringMatching(/^connector:connection-1:reconnect:/),
      }),
    );
  });

  it("stamps a fresh consent window on the reconnected connection", async () => {
    const { service, registry, db } = createService();
    registry.get.mockReturnValue({
      manifest: TRUELAYER_MANIFEST,
      testConnection: vi.fn(),
      sync: vi.fn(),
    } as unknown as FinancialConnector);
    const chain = chainMock(makeConnectionRow({ providerId: TRUELAYER_PROVIDER_ID }));
    db.update.mockReturnValue(chain);

    await service.reconnectOAuthConnection({
      connectionId: "connection-1",
      userId: "user-1",
      providerId: TRUELAYER_PROVIDER_ID,
      environment: "production",
      credentials: { accessToken: "fresh-token" },
    });

    const [update] = chain.set.mock.calls[0] as [Record<string, Date | null>];
    expect(update.consentGrantedAt).toBeInstanceOf(Date);
    // TrueLayer's estimated 90-day consent lifetime, re-based on this grant.
    expect(update.consentExpiresAt?.getTime()).toBeCloseTo(
      (update.consentGrantedAt as Date).getTime() + 90 * 24 * 60 * 60 * 1000,
      -3,
    );
  });

  it("returns a 404 when the connection to reconnect is not the caller's", async () => {
    const { service, registry, db, queue } = createService();
    registry.get.mockReturnValue({
      manifest: TRUELAYER_MANIFEST,
      testConnection: vi.fn(),
      sync: vi.fn(),
    } as unknown as FinancialConnector);
    db.update.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    });

    await expect(
      service.reconnectOAuthConnection({
        connectionId: "someone-elses-connection",
        userId: "user-1",
        providerId: TRUELAYER_PROVIDER_ID,
        environment: "production",
        credentials: { accessToken: "fresh-token" },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("refuses to reconnect a provider that does not use OAuth2 credentials", async () => {
    const { service, db } = createService();

    await expect(
      service.reconnectOAuthConnection({
        connectionId: "connection-1",
        userId: "user-1",
        providerId: TRADING212_PROVIDER_ID,
        environment: "live",
        credentials: { accessToken: "fresh-token" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("pairs each connection with the accounts it covers", async () => {
    const { service, db } = createService();
    const createdAt = new Date("2026-01-30T10:00:00Z");
    mockSelectChains(db, [
      [
        { id: "connection-1", metadata: { accountIds: ["acc-1"] }, createdAt },
        { id: "connection-2", metadata: {}, createdAt },
      ],
      [
        { connectionId: "connection-1", externalId: "truelayer:account:acc-1" },
        { connectionId: "connection-1", externalId: "truelayer:account:acc-2" },
      ],
    ]);

    const result = await service.listConnectionAccounts(
      "user-1",
      TRUELAYER_PROVIDER_ID,
      "production",
    );

    expect(result).toEqual([
      {
        id: "connection-1",
        metadata: { accountIds: ["acc-1"] },
        createdAt,
        accountExternalIds: ["truelayer:account:acc-1", "truelayer:account:acc-2"],
      },
      // Synced nothing yet, so it reports no accounts rather than being dropped.
      { id: "connection-2", metadata: {}, createdAt, accountExternalIds: [] },
    ]);
  });

  it("skips the accounts query when the user has no connections for the provider", async () => {
    const { service, db } = createService();
    const { select } = mockSelectChains(db, [[]]);

    await expect(
      service.listConnectionAccounts("user-1", TRUELAYER_PROVIDER_ID, "production"),
    ).resolves.toEqual([]);
    expect(select).toHaveBeenCalledOnce();
  });
});

function makeConnectionRow(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date("2026-01-30T10:00:00Z");
  return {
    id: "connection-1",
    userId: "user-1",
    providerId: TRADING212_PROVIDER_ID,
    providerName: TRADING212_MANIFEST.displayName,
    environment: "live",
    encryptedCredentials: "encrypted-credentials",
    credentialKeyId: "key-1",
    capabilities: [...TRADING212_MANIFEST.capabilities],
    metadata: {},
    syncStatus: "OK",
    lastSyncedAt: null,
    nextSyncAt: createdAt,
    lastSyncErrorCode: null,
    lastSyncErrorMessage: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function mockDeleteChains(db: ReturnType<typeof createMockDb>, rows: unknown[]) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  const deleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  (db as unknown as { select: ReturnType<typeof vi.fn> }).select = vi.fn(() => selectChain);
  (db as unknown as { delete: ReturnType<typeof vi.fn> }).delete = vi.fn(() => deleteChain);
  return { selectChain, deleteChain };
}

function mockSelectChains(db: ReturnType<typeof createMockDb>, resultsPerCall: unknown[][]) {
  const select = vi.fn(() => {
    const rows = resultsPerCall.shift() ?? [];
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(rows),
    };
  });
  (db as unknown as { select: ReturnType<typeof vi.fn> }).select = select;
  return { select };
}
