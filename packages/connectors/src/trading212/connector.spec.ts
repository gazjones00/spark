import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectorAuthError, ConnectorSchemaError } from "../core/index.ts";
import { Trading212Connector } from "./connector.ts";
import {
  trading212AccountSummaryFixture,
  trading212BuyOrderFixture,
  trading212CashTransactionFixture,
  trading212DividendFixture,
  trading212InstrumentFixture,
  trading212PositionFixture,
} from "./testing/fixtures/trading212.fixtures.ts";

describe("Trading212Connector", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("syncs current Trading 212 API resources into canonical connector records", async () => {
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requestedUrls.push(url.toString());

      if (url.pathname === "/api/v0/equity/account/summary") {
        return Response.json(trading212AccountSummaryFixture);
      }
      if (url.pathname === "/api/v0/equity/positions") {
        return Response.json([trading212PositionFixture]);
      }
      if (url.pathname === "/api/v0/equity/metadata/instruments") {
        return Response.json([trading212InstrumentFixture]);
      }
      if (url.pathname === "/api/v0/equity/history/orders") {
        return Response.json({ items: [trading212BuyOrderFixture], nextPagePath: null });
      }
      if (url.pathname === "/api/v0/equity/history/dividends") {
        return Response.json({ items: [trading212DividendFixture], nextPagePath: null });
      }
      if (url.pathname === "/api/v0/equity/history/transactions") {
        return Response.json({ items: [trading212CashTransactionFixture], nextPagePath: null });
      }

      return Response.json({ message: "not found" }, { status: 404 });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const connector = new Trading212Connector();
    const result = await connector.sync({
      connectionId: "connection-1",
      userId: "user-1",
      environment: "live",
      credentials: {
        apiKey: "key",
        apiSecret: "secret",
      },
      requestedAt: new Date("2026-01-30T10:00:00Z"),
    });

    expect(result.status).toBe("success");
    expect(result.accounts).toHaveLength(1);
    expect(result.balanceSnapshots).toHaveLength(1);
    expect(result.portfolioSnapshots).toHaveLength(1);
    expect(result.holdings).toHaveLength(1);
    expect(result.instruments).toHaveLength(1);
    expect(result.transactions).toHaveLength(3);
    expect(result.rawRecords.map((record) => record.resource)).toEqual([
      "account-summary",
      "positions",
      "instruments",
      "history-orders",
      "history-dividends",
      "history-transactions",
    ]);
    expect(result.cursors).toEqual([
      {
        resource: "history-orders",
        cursor: null,
        checkpoint: "2026-01-11T10:00:00.000Z",
      },
      {
        resource: "history-dividends",
        cursor: null,
        checkpoint: "2026-01-12T10:00:00.000Z",
      },
      {
        resource: "history-transactions",
        cursor: null,
        checkpoint: "2026-01-13T10:00:00.000Z",
      },
    ]);
    expect(requestedUrls.some((url) => url.endsWith("/api/v0/equity/account/summary"))).toBe(true);
  });

  it("filters paginated history from stored checkpoints", async () => {
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requestedUrls.push(url.toString());

      if (url.pathname === "/api/v0/equity/account/summary") {
        return Response.json(trading212AccountSummaryFixture);
      }
      if (url.pathname === "/api/v0/equity/positions") {
        return Response.json([]);
      }
      if (url.pathname === "/api/v0/equity/metadata/instruments") {
        return Response.json([]);
      }
      if (url.pathname === "/api/v0/equity/history/orders") {
        return Response.json({ items: [trading212BuyOrderFixture], nextPagePath: null });
      }
      if (url.pathname === "/api/v0/equity/history/dividends") {
        return Response.json({ items: [trading212DividendFixture], nextPagePath: null });
      }
      if (url.pathname === "/api/v0/equity/history/transactions") {
        return Response.json({ items: [trading212CashTransactionFixture], nextPagePath: null });
      }

      return Response.json({ message: "not found" }, { status: 404 });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const connector = new Trading212Connector();
    const result = await connector.sync({
      connectionId: "connection-1",
      userId: "user-1",
      environment: "live",
      credentials: {
        apiKey: "key",
        apiSecret: "secret",
      },
      cursors: [
        {
          resource: "history-orders",
          cursor: null,
          checkpoint: "2026-01-13T10:00:00.000Z",
        },
        {
          resource: "history-dividends",
          cursor: null,
          checkpoint: "2026-01-13T10:00:00.000Z",
        },
        {
          resource: "history-transactions",
          cursor: null,
          checkpoint: "2026-01-13T10:00:00.000Z",
        },
      ],
    });

    expect(result.transactions).toHaveLength(0);
    expect(result.rawRecords.map((record) => record.resource)).toEqual(["account-summary"]);
    const transactionsUrl = requestedUrls.find((url) =>
      url.includes("/api/v0/equity/history/transactions"),
    );
    expect(transactionsUrl).not.toContain("time=");
  });

  it("walks every page when the API returns nextPagePath, then stops on null", async () => {
    const ordersPath = "/api/v0/equity/history/orders";
    const orderPages = [
      { items: [{ ...trading212BuyOrderFixture }], nextPagePath: `${ordersPath}?cursor=p2` },
      {
        items: [
          {
            ...trading212BuyOrderFixture,
            order: { ...trading212BuyOrderFixture.order, id: 987654322 },
            fill: { ...trading212BuyOrderFixture.fill!, id: 1, filledAt: "2026-01-15T10:00:00Z" },
          },
        ],
        nextPagePath: null,
      },
    ];
    const requestedOrderUrls: string[] = [];
    let orderPageIndex = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v0/equity/account/summary") {
        return Response.json(trading212AccountSummaryFixture);
      }
      if (url.pathname === "/api/v0/equity/positions") return Response.json([]);
      if (url.pathname === "/api/v0/equity/metadata/instruments") return Response.json([]);
      if (url.pathname === ordersPath) {
        requestedOrderUrls.push(url.toString());
        return Response.json(orderPages[orderPageIndex++]);
      }
      if (url.pathname === "/api/v0/equity/history/dividends") {
        return Response.json({ items: [], nextPagePath: null });
      }
      if (url.pathname === "/api/v0/equity/history/transactions") {
        return Response.json({ items: [], nextPagePath: null });
      }
      return Response.json({ message: "not found" }, { status: 404 });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const result = await new Trading212Connector().sync({
      connectionId: "connection-1",
      userId: "user-1",
      environment: "live",
      credentials: { apiKey: "key", apiSecret: "secret" },
    });

    expect(requestedOrderUrls).toHaveLength(2);
    expect(requestedOrderUrls[1]).toContain("cursor=p2");
    expect(result.transactions.filter((t) => t.providerId === "trading212")).toHaveLength(2);
    expect(result.cursors.find((c) => c.resource === "history-orders")?.cursor).toBeNull();
    expect(result.cursors.find((c) => c.resource === "history-orders")?.checkpoint).toBe(
      "2026-01-15T10:00:00.000Z",
    );
  });

  it("supports the demo environment", async () => {
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requestedUrls.push(url.toString());

      if (url.pathname === "/api/v0/equity/account/summary") {
        return Response.json(trading212AccountSummaryFixture);
      }
      if (url.pathname === "/api/v0/equity/positions") return Response.json([]);
      if (url.pathname === "/api/v0/equity/metadata/instruments") return Response.json([]);
      if (url.pathname === "/api/v0/equity/history/orders") {
        return Response.json({ items: [], nextPagePath: null });
      }
      if (url.pathname === "/api/v0/equity/history/dividends") {
        return Response.json({ items: [], nextPagePath: null });
      }
      if (url.pathname === "/api/v0/equity/history/transactions") {
        return Response.json({ items: [], nextPagePath: null });
      }
      return Response.json({ message: "not found" }, { status: 404 });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    await expect(
      new Trading212Connector().sync({
        connectionId: "connection-1",
        userId: "user-1",
        environment: "demo",
        credentials: { apiKey: "key", apiSecret: "secret" },
      }),
    ).resolves.toMatchObject({ status: "success" });
    expect(requestedUrls[0]).toContain("https://demo.trading212.com/api/v0/");
  });

  it("rejects unsupported environments before issuing any request", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new Trading212Connector().sync({
        connectionId: "connection-1",
        userId: "user-1",
        environment: "sandbox",
        credentials: { apiKey: "key", apiSecret: "secret" },
      }),
    ).rejects.toBeInstanceOf(ConnectorAuthError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces auth errors from the upstream account summary call", async () => {
    globalThis.fetch = (async () =>
      new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;

    await expect(
      new Trading212Connector().sync({
        connectionId: "connection-1",
        userId: "user-1",
        environment: "live",
        credentials: { apiKey: "bad", apiSecret: "bad" },
      }),
    ).rejects.toBeInstanceOf(ConnectorAuthError);
  });

  it("raises a schema error when the upstream payload no longer matches the schema", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v0/equity/account/summary") {
        return Response.json({ id: "not-a-number", currency: 42 });
      }
      return Response.json({}, { status: 404 });
    }) as unknown as typeof fetch;

    await expect(
      new Trading212Connector().sync({
        connectionId: "connection-1",
        userId: "user-1",
        environment: "live",
        credentials: { apiKey: "key", apiSecret: "secret" },
      }),
    ).rejects.toBeInstanceOf(ConnectorSchemaError);
  });
});
