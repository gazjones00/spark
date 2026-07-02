import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpTimeoutError, parseRetryAfterMs, resilientFetch } from "./http.ts";

describe("parseRetryAfterMs", () => {
  const now = Date.parse("2026-07-01T12:00:00Z");

  function headers(entries: Record<string, string>): Headers {
    return new Headers(entries);
  }

  it("parses delta-seconds Retry-After", () => {
    expect(parseRetryAfterMs(headers({ "Retry-After": "30" }), now)).toBe(30_000);
  });

  it("parses HTTP-date Retry-After relative to now", () => {
    const date = new Date(now + 90_000).toUTCString();
    expect(parseRetryAfterMs(headers({ "Retry-After": date }), now)).toBe(90_000);
  });

  it("returns a negative delay for past HTTP-dates (caller floors)", () => {
    const date = new Date(now - 5_000).toUTCString();
    expect(parseRetryAfterMs(headers({ "Retry-After": date }), now)).toBeLessThan(0);
  });

  it("falls back to X-RateLimit-Reset epoch seconds", () => {
    const resetEpochSeconds = Math.floor((now + 45_000) / 1000);
    expect(
      parseRetryAfterMs(headers({ "X-RateLimit-Reset": String(resetEpochSeconds) }), now),
    ).toBe(resetEpochSeconds * 1000 - now);
  });

  it("prefers Retry-After over X-RateLimit-Reset", () => {
    expect(
      parseRetryAfterMs(headers({ "Retry-After": "10", "X-RateLimit-Reset": "9999999999" }), now),
    ).toBe(10_000);
  });

  it("returns null for missing or garbage headers", () => {
    expect(parseRetryAfterMs(headers({}), now)).toBeNull();
    expect(parseRetryAfterMs(headers({ "Retry-After": "soon" }), now)).toBeNull();
    expect(parseRetryAfterMs(headers({ "X-RateLimit-Reset": "not-a-number" }), now)).toBeNull();
  });
});

describe("resilientFetch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts a hung request after timeoutMs and throws HttpTimeoutError", async () => {
    vi.useFakeTimers();
    const hangingFetch = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    const pending = resilientFetch("https://api.example.com/slow", {
      timeoutMs: 5_000,
      fetchFn: hangingFetch as unknown as typeof fetch,
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(HttpTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it("returns the response and clears the timer on success", async () => {
    vi.useFakeTimers();
    const response = new Response("ok");
    const fetchFn = vi.fn().mockResolvedValue(response);

    await expect(
      resilientFetch("https://api.example.com/fast", {
        timeoutMs: 5_000,
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    ).resolves.toBe(response);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes non-timeout failures through untouched", async () => {
    const failure = new Error("connection refused");
    const fetchFn = vi.fn().mockRejectedValue(failure);

    await expect(
      resilientFetch("https://api.example.com", {
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    ).rejects.toBe(failure);
  });

  it("forwards method, headers and the abort signal to the fetch implementation", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("ok"));

    await resilientFetch("https://api.example.com", {
      method: "GET",
      headers: { Accept: "application/json" },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("GET");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
