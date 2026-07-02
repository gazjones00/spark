import { ConnectorRateLimitError } from "@spark/connectors";
import { describe, expect, it, vi } from "vitest";
import type { ConnectorSyncService } from "../modules/connectors";
import { ConnectorSyncJob } from "./connector-sync.job";

describe("ConnectorSyncJob", () => {
  it("delegates queued connector sync work to ConnectorSyncService", async () => {
    const syncService = {
      syncConnection: vi.fn(async () => ({
        syncResult: { status: "success" },
        syncRunId: "sync-run-1",
        recordsRead: 3,
        recordsWritten: 3,
      })),
    };
    const job = new ConnectorSyncJob(syncService as unknown as ConnectorSyncService);

    await job.handle({
      connectionId: "connection-1",
      userId: "user-1",
      requestedAt: "2026-01-30T10:00:00.000Z",
    });

    expect(syncService.syncConnection).toHaveBeenCalledWith({
      connectionId: "connection-1",
      userId: "user-1",
      requestedAt: new Date("2026-01-30T10:00:00.000Z"),
    });
  });

  it("completes (no BullMQ retry) when the sync is rate-limited — nextSyncAt owns the reschedule", async () => {
    const syncService = {
      syncConnection: vi.fn(async () => {
        throw new ConnectorRateLimitError("throttled", { retryAfterMs: 30_000 });
      }),
    };
    const job = new ConnectorSyncJob(syncService as unknown as ConnectorSyncService);

    await expect(
      job.handle({ connectionId: "connection-1", userId: "user-1" }),
    ).resolves.toBeUndefined();
  });

  it("rethrows other failures so BullMQ can retry them", async () => {
    const syncService = {
      syncConnection: vi.fn(async () => {
        throw new Error("transient upstream failure");
      }),
    };
    const job = new ConnectorSyncJob(syncService as unknown as ConnectorSyncService);

    await expect(job.handle({ connectionId: "connection-1", userId: "user-1" })).rejects.toThrow(
      "transient upstream failure",
    );
  });
});
