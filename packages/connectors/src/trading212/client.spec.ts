import { describe, expect, it, vi } from "vitest";
import { ConnectorAuthError, ConnectorError } from "../core/index.ts";
import { Trading212Client } from "./client.ts";
import {
  trading212AccountSummaryFixture,
  trading212BuyOrderFixture,
} from "./testing/fixtures/trading212.fixtures.ts";

describe("Trading212Client", () => {
  it("uses Basic auth and parses account summary", async () => {
    let authorizationHeader = "";
    const fetchMock = (async (_input, init) => {
      authorizationHeader = new Headers(init?.headers).get("Authorization") ?? "";
      return Response.json(trading212AccountSummaryFixture);
    }) as typeof fetch;
    const client = new Trading212Client({
      apiKey: "key",
      apiSecret: "secret",
      baseUrl: "https://example.test/api/v0",
      fetch: fetchMock,
    });

    await expect(client.getAccountSummary()).resolves.toEqual(trading212AccountSummaryFixture);
    expect(authorizationHeader).toBe(`Basic ${btoa("key:secret")}`);
  });

  it("uses nextPagePath as the next paginated request path", async () => {
    const requestedUrls: string[] = [];
    const fetchMock = (async (input) => {
      requestedUrls.push(String(input));
      return Response.json({
        items: [trading212BuyOrderFixture],
        nextPagePath: null,
      });
    }) as typeof fetch;
    const client = new Trading212Client({
      apiKey: "key",
      apiSecret: "secret",
      baseUrl: "https://example.test/api/v0",
      fetch: fetchMock,
    });

    const page = await client.getHistoricalOrders({
      nextPagePath: "/api/v0/equity/history/orders?limit=50&cursor=abc",
    });

    expect(page.items).toHaveLength(1);
    expect(requestedUrls[0]).toBe(
      "https://example.test/api/v0/equity/history/orders?limit=50&cursor=abc",
    );
  });

  it("rejects absolute pagination URLs from a different origin before sending auth", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const client = new Trading212Client({
      apiKey: "key",
      apiSecret: "secret",
      baseUrl: "https://example.test/api/v0",
      fetch: fetchMock,
    });

    await expect(
      client.getHistoricalOrders({
        nextPagePath: "https://attacker.test/api/v0/equity/history/orders?cursor=abc",
      }),
    ).rejects.toMatchObject({
      name: ConnectorError.name,
      code: "CONNECTOR_INVALID_NEXT_PAGE_URL",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a connector error with the JSON parse cause for invalid JSON responses", async () => {
    const parseError = new SyntaxError("Unexpected token");
    const fetchMock = (async () =>
      ({
        ok: true,
        json: async () => {
          throw parseError;
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const client = new Trading212Client({
      apiKey: "key",
      apiSecret: "secret",
      baseUrl: "https://example.test/api/v0",
      fetch: fetchMock,
    });

    await expect(client.getAccountSummary()).rejects.toMatchObject({
      name: ConnectorError.name,
      message: "Trading 212 returned invalid JSON.",
      code: "CONNECTOR_INVALID_JSON",
      cause: parseError,
    });
  });

  it("does not parse non-JSON authentication failures before mapping auth errors", async () => {
    const fetchMock = (async () =>
      ({
        ok: false,
        status: 401,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const client = new Trading212Client({
      apiKey: "key",
      apiSecret: "secret",
      baseUrl: "https://example.test/api/v0",
      fetch: fetchMock,
    });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(ConnectorAuthError);
  });

  it("throws ConnectorRateLimitError carrying the parsed Retry-After hint on 429 (TASK-008 AC-2)", async () => {
    const fetchMock = (async () =>
      new Response("", {
        status: 429,
        headers: { "Retry-After": "30" },
      })) as unknown as typeof fetch;
    const client = new Trading212Client({
      apiKey: "key",
      apiSecret: "secret",
      baseUrl: "https://example.test/api/v0",
      fetch: fetchMock,
    });

    await expect(client.getAccountSummary()).rejects.toMatchObject({
      name: "ConnectorRateLimitError",
      code: "CONNECTOR_RATE_LIMIT_ERROR",
      retryAfterMs: 30_000,
    });
  });

  it("reports a null hint when the 429 has no backoff headers", async () => {
    const fetchMock = (async () => new Response("", { status: 429 })) as unknown as typeof fetch;
    const client = new Trading212Client({
      apiKey: "key",
      apiSecret: "secret",
      baseUrl: "https://example.test/api/v0",
      fetch: fetchMock,
    });

    await expect(client.getAccountSummary()).rejects.toMatchObject({
      code: "CONNECTOR_RATE_LIMIT_ERROR",
      retryAfterMs: null,
    });
  });

  it("aborts a hung request after timeoutMs and maps it to ConnectorTimeoutError (TASK-008 AC-1)", async () => {
    const fetchMock = ((_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    const client = new Trading212Client({
      apiKey: "key",
      apiSecret: "secret",
      baseUrl: "https://example.test/api/v0",
      fetch: fetchMock,
      timeoutMs: 10,
    });

    await expect(client.getAccountSummary()).rejects.toMatchObject({
      name: "ConnectorTimeoutError",
      code: "CONNECTOR_TIMEOUT",
    });
  });
});
