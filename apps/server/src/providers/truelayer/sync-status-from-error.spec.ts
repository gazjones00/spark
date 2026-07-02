import { SyncStatus } from "@spark/common";
import { TrueLayerAuthError, TrueLayerRateLimitError } from "@spark/truelayer/server";
import { describe, expect, it } from "vitest";
import { syncStatusFromError } from "./sync-status-from-error";
import { TokenExpiredError } from "./truelayer.connection.service";

describe("syncStatusFromError", () => {
  it("maps TokenExpiredError to NEEDS_REAUTH", () => {
    expect(syncStatusFromError(new TokenExpiredError("conn-1"))).toBe(SyncStatus.NEEDS_REAUTH);
  });

  it("maps TrueLayerAuthError to NEEDS_REAUTH", () => {
    expect(syncStatusFromError(new TrueLayerAuthError("access_denied", "revoked", 401))).toBe(
      SyncStatus.NEEDS_REAUTH,
    );
  });

  it("maps a generic Error to ERROR", () => {
    expect(syncStatusFromError(new Error("TrueLayer request failed: 500"))).toBe(SyncStatus.ERROR);
  });

  it("maps TrueLayerRateLimitError to ERROR", () => {
    expect(syncStatusFromError(new TrueLayerRateLimitError(30_000))).toBe(SyncStatus.ERROR);
  });

  it("maps an unknown non-error value to ERROR", () => {
    expect(syncStatusFromError("boom")).toBe(SyncStatus.ERROR);
  });
});
