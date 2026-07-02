import { SyncStatus } from "@spark/common";
import { TrueLayerAuthError, TrueLayerRateLimitError } from "@spark/truelayer/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syncErrorBackoff } from "./sync-error-backoff";
import { TokenRefreshError } from "./truelayer.connection.service";

describe("syncErrorBackoff", () => {
  const now = Date.parse("2026-07-01T12:00:00Z");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not schedule terminal NEEDS_REAUTH errors", () => {
    const result = syncErrorBackoff(new TrueLayerAuthError("access_denied", "revoked", 401), now);

    expect(result.status).toBe(SyncStatus.NEEDS_REAUTH);
    expect(result.nextSyncAt).toBeUndefined();
  });

  it("uses the generic 30-minute backoff for non-rate-limit transient failures", () => {
    const result = syncErrorBackoff(new Error("TrueLayer request failed: 500"), now);

    expect(result.status).toBe(SyncStatus.ERROR);
    expect(result.nextSyncAt?.getTime()).toBe(now + 30 * 60 * 1000);
  });

  it("uses a rate-limit Retry-After hint when present", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = syncErrorBackoff(new TrueLayerRateLimitError(90_000), now);

    expect(result.status).toBe(SyncStatus.ERROR);
    expect(result.rateLimitRetryAfterMs).toBe(90_000);
    expect(result.nextSyncAt?.getTime()).toBe(now + 90_000);
  });

  it("finds rate-limit errors wrapped as a cause", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const error = new TokenRefreshError("conn-1", new TrueLayerRateLimitError(45_000));

    const result = syncErrorBackoff(error, now);

    expect(result.rateLimitRetryAfterMs).toBe(45_000);
    expect(result.nextSyncAt?.getTime()).toBe(now + 45_000);
  });

  it("applies the bounded default when the provider sent no retry hint", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = syncErrorBackoff(new TrueLayerRateLimitError(null), now);

    expect(result.rateLimitRetryAfterMs).toBeNull();
    expect(result.nextSyncAt?.getTime()).toBe(now + 60_000);
  });
});
