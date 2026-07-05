import type { ConnectorSyncResult } from "@spark/connectors";
import { SyncStatus } from "@spark/common";
import { connectorConnections } from "@spark/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnrichmentService } from "../enrichment";
import { ConnectorPersistenceService } from "./connector-persistence.service";
import type { DailyBalanceService } from "./daily-balance.service";

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

function createService(options: { consecutiveFailures?: number } = {}) {
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
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn().mockResolvedValue([{ consecutiveFailures: options.consecutiveFailures ?? 0 }]),
  };
  const tx = {
    update: vi.fn((table: unknown) => {
      lastUpdateTable = table;
      return updateChain;
    }),
    insert: vi.fn(() => insertChain),
    select: vi.fn(() => selectChain),
  };
  const db = {
    transaction: vi.fn((cb: (txArg: unknown) => unknown) => cb(tx)),
  };

  const dailyBalanceService = {
    captureExistingBuckets: vi.fn(async () => new Map<string, Set<string>>()),
    refreshForBatch: vi.fn(async () => undefined),
  };
  const enrichmentService = {
    enrichBatch: vi.fn(async () => []),
  };
  const service = new ConnectorPersistenceService(
    db as never,
    dailyBalanceService as unknown as DailyBalanceService,
    enrichmentService as unknown as EnrichmentService,
  );
  const connectionState = () =>
    setCalls.find((call) => call.table === connectorConnections)?.payload;

  return { service, connectionState, dailyBalanceService, enrichmentService };
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

  it("reschedules a rate-limited failure on the provider hint, not the generic backoff", async () => {
    const { service, connectionState } = createService();
    const before = Date.now();

    await service.persistSyncResult({
      userId: "user-1",
      connectionId: "conn-1",
      result: emptyResult({
        status: "failed",
        errors: [
          { code: "CONNECTOR_RATE_LIMIT_ERROR", message: "rate limited", retryAfterMs: 90_000 },
        ],
      }),
    });

    const state = connectionState();
    expect(state?.syncStatus).toBe(SyncStatus.ERROR);
    expect(state).toBeDefined();
    const delay = (state!.nextSyncAt as Date).getTime() - before;
    // Hint of 90s, plus up to 10% jitter (and a little test slack).
    expect(delay).toBeGreaterThanOrEqual(90_000);
    expect(delay).toBeLessThanOrEqual(100_000);
    expect(state?.consecutiveFailures).toBe(1);
  });

  it("applies the bounded default when the 429 carried no hint", async () => {
    const { service, connectionState } = createService();
    const before = Date.now();

    await service.persistSyncResult({
      userId: "user-1",
      connectionId: "conn-1",
      result: emptyResult({
        status: "failed",
        errors: [
          { code: "CONNECTOR_RATE_LIMIT_ERROR", message: "rate limited", retryAfterMs: null },
        ],
      }),
    });

    const state = connectionState();
    expect(state).toBeDefined();
    const delay = (state!.nextSyncAt as Date).getTime() - before;
    expect(delay).toBeGreaterThanOrEqual(60_000);
    expect(delay).toBeLessThanOrEqual(70_000);
  });

  it("clamps a hostile Retry-After hint to the 1h ceiling", async () => {
    const { service, connectionState } = createService();
    const before = Date.now();

    await service.persistSyncResult({
      userId: "user-1",
      connectionId: "conn-1",
      result: emptyResult({
        status: "failed",
        errors: [
          {
            code: "CONNECTOR_RATE_LIMIT_ERROR",
            message: "rate limited",
            retryAfterMs: 48 * 60 * 60 * 1000,
          },
        ],
      }),
    });

    const state = connectionState();
    expect(state).toBeDefined();
    const delay = (state!.nextSyncAt as Date).getTime() - before;
    expect(delay).toBeLessThanOrEqual(3_600_000 * 1.1 + 1_000);
  });

  it("opens the breaker at the failure threshold: cool-down floor + counter", async () => {
    // 4 prior failures; this one crosses the default threshold of 5.
    const { service, connectionState } = createService({ consecutiveFailures: 4 });
    const before = Date.now();

    await service.persistSyncResult({
      userId: "user-1",
      connectionId: "conn-1",
      result: emptyResult({
        status: "failed",
        errors: [
          { code: "CONNECTOR_RATE_LIMIT_ERROR", message: "rate limited", retryAfterMs: 1_000 },
        ],
      }),
    });

    const state = connectionState();
    expect(state?.consecutiveFailures).toBe(5);
    expect(state).toBeDefined();
    const delay = (state!.nextSyncAt as Date).getTime() - before;
    // The 1s hint is floored by the breaker cool-down (default 120s).
    expect(delay).toBeGreaterThanOrEqual(120_000);
  });

  it("closes the breaker on a successful half-open probe (counter resets)", async () => {
    const { service, connectionState } = createService({ consecutiveFailures: 6 });

    await service.persistSyncResult({
      userId: "user-1",
      connectionId: "conn-1",
      result: emptyResult({ status: "success" }),
    });

    const state = connectionState();
    expect(state?.syncStatus).toBe(SyncStatus.OK);
    expect(state?.consecutiveFailures).toBe(0);
  });

  it("does not touch the failure counter for NEEDS_REAUTH (terminal, not breaker-relevant)", async () => {
    const { service, connectionState } = createService({ consecutiveFailures: 2 });

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
    expect(state).not.toHaveProperty("nextSyncAt");
    expect(state).not.toHaveProperty("consecutiveFailures");
  });

  it("refreshes the daily balances inside the persistence transaction", async () => {
    const { service, dailyBalanceService } = createService();
    const result = emptyResult();
    const previousBuckets = new Map([["truelayer:account:acc-1", new Set(["2026-06-01"])]]);
    dailyBalanceService.captureExistingBuckets.mockResolvedValueOnce(previousBuckets);

    await service.persistSyncResult({
      userId: "user-1",
      connectionId: "conn-1",
      result,
    });

    // Pre-upsert buckets are captured and handed to the refresh, so an
    // update that moves a transaction across days recomputes the old day.
    expect(dailyBalanceService.captureExistingBuckets).toHaveBeenCalledWith(
      expect.anything(),
      "conn-1",
      result.transactions,
    );
    expect(dailyBalanceService.refreshForBatch).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-1",
      connectionId: "conn-1",
      transactions: result.transactions,
      previousBuckets,
    });
  });
});
