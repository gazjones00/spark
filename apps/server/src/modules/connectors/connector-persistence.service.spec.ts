import type { ConnectorSyncResult } from "@spark/connectors";
import { SyncStatus } from "@spark/common";
import { connectorConnections } from "@spark/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorPersistenceService } from "./connector-persistence.service";

function emptyResult(overrides: Partial<ConnectorSyncResult> = {}): ConnectorSyncResult {
  return {
    status: "success",
    providerId: "trading212",
    connectionId: "conn-1",
    rawRecords: [],
    accounts: [],
    instruments: [],
    transactions: [],
    holdings: [],
    balanceSnapshots: [],
    portfolioSnapshots: [],
    cursors: [],
    errors: [],
    ...overrides,
  };
}

function createService() {
  // Capture the payload passed to connectorConnections .set(); the sync-run
  // insert reuses the same chain harmlessly.
  const setCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];
  let lastUpdateTable: unknown;

  const updateChain = {
    set: vi.fn((payload: Record<string, unknown>) => {
      setCalls.push({ table: lastUpdateTable, payload });
      return updateChain;
    }),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const insertChain = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  const tx = {
    update: vi.fn((table: unknown) => {
      lastUpdateTable = table;
      return updateChain;
    }),
    insert: vi.fn(() => insertChain),
  };
  const db = {
    transaction: vi.fn((cb: (txArg: unknown) => unknown) => cb(tx)),
  };

  const service = new ConnectorPersistenceService(db as never);
  const connectionState = () =>
    setCalls.find((call) => call.table === connectorConnections)?.payload;

  return { service, connectionState };
}

describe("ConnectorPersistenceService.updateConnectionSyncState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps CONNECTOR_AUTH_ERROR to NEEDS_REAUTH with no retry backoff", async () => {
    const { service, connectionState } = createService();

    await service.persistSyncResult({
      userId: "user-1",
      connectionId: "conn-1",
      result: emptyResult({
        status: "failed",
        errors: [{ code: "CONNECTOR_AUTH_ERROR", message: "auth failed" }],
      }),
    });

    const state = connectionState();
    expect(state?.syncStatus).toBe(SyncStatus.NEEDS_REAUTH);
    // Terminal: must not schedule a future retry.
    expect(state).not.toHaveProperty("nextSyncAt");
  });

  it("maps a non-auth failure to ERROR with a retry backoff", async () => {
    const { service, connectionState } = createService();

    await service.persistSyncResult({
      userId: "user-1",
      connectionId: "conn-1",
      result: emptyResult({
        status: "failed",
        errors: [{ code: "CONNECTOR_RATE_LIMIT_ERROR", message: "rate limited" }],
      }),
    });

    const state = connectionState();
    expect(state?.syncStatus).toBe(SyncStatus.ERROR);
    expect(state?.nextSyncAt).toBeInstanceOf(Date);
  });

  it("maps success to OK with the normal cadence", async () => {
    const { service, connectionState } = createService();

    await service.persistSyncResult({
      userId: "user-1",
      connectionId: "conn-1",
      result: emptyResult({ status: "success" }),
    });

    const state = connectionState();
    expect(state?.syncStatus).toBe(SyncStatus.OK);
    expect(state?.nextSyncAt).toBeInstanceOf(Date);
    expect(state?.lastSyncedAt).toBeInstanceOf(Date);
  });
});
