import { SyncStatus } from "@spark/common";
import { truelayerAccounts } from "@spark/db/schema";
import { TrueLayerAuthError } from "@spark/truelayer/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TruelayerClient, TruelayerConnectionService } from "../../../providers/truelayer";
import { TruelayerAccountStatusService } from "../../../providers/truelayer";
import { BalanceService } from "./balance.service";

function createService(options: { getBalanceError?: unknown } = {}) {
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const db = {
    update: vi.fn(() => updateChain),
  };
  const truelayerClient = {
    getBalance: options.getBalanceError
      ? vi.fn(async () => {
          throw options.getBalanceError;
        })
      : vi.fn(async () => ({
          currency: "GBP",
          current: 100,
          available: 90,
          overdraft: null,
          updateTimestamp: "2026-01-01T00:00:00.000Z",
        })),
  };
  const connectionService = {
    getAccessToken: vi.fn(async () => "access-token"),
  };
  const statusService = new TruelayerAccountStatusService(db as never);

  const service = new BalanceService(
    truelayerClient as unknown as TruelayerClient,
    connectionService as unknown as TruelayerConnectionService,
    statusService,
    db as never,
  );

  return { service, db, updateChain };
}

describe("BalanceService.syncBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes NEEDS_REAUTH (no backoff) and re-throws when getBalance hits a bank-side 401", async () => {
    const { service, db, updateChain } = createService({
      getBalanceError: new TrueLayerAuthError("access_denied", "revoked", 401),
    });

    await expect(
      service.syncBalance({ accountId: "acc-1", connectionId: "conn-1" }),
    ).rejects.toBeInstanceOf(TrueLayerAuthError);

    // Regression guard: the balance path previously re-threw without ever
    // recording sync status.
    expect(db.update).toHaveBeenCalledWith(truelayerAccounts);
    const set = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(set.syncStatus).toBe(SyncStatus.NEEDS_REAUTH);
    expect(set).not.toHaveProperty("nextSyncAt");
  });

  it("writes ERROR with a 30-minute backoff on a transient failure", async () => {
    const { service, updateChain } = createService({
      getBalanceError: new Error("TrueLayer request failed: 500"),
    });

    const before = Date.now();
    await expect(
      service.syncBalance({ accountId: "acc-1", connectionId: "conn-1" }),
    ).rejects.toThrow();

    const set = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(set.syncStatus).toBe(SyncStatus.ERROR);
    const nextSyncAt = set.nextSyncAt as Date;
    expect(nextSyncAt).toBeInstanceOf(Date);
    expect(nextSyncAt.getTime()).toBeGreaterThanOrEqual(before + 29 * 60 * 1000);
  });
});
