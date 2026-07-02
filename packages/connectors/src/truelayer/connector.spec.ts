import { describe, expect, it, vi } from "vitest";
import { TrueLayerAuthError, TrueLayerRateLimitError } from "@spark/truelayer/server";
import type { Account, Balance, Transaction } from "@spark/truelayer/types";
import {
  ConnectorAuthError,
  ConnectorRateLimitError,
  type ConnectorSyncContext,
} from "../core/index.ts";
import { transactionsResource, TrueLayerConnector } from "./connector.ts";
import { TRUELAYER_MANIFEST } from "./constants.ts";
import { ConnectorManifestSchema } from "../core/manifest.ts";

const ACCOUNT: Account = {
  updateTimestamp: "2026-06-30T12:00:00.000Z",
  accountId: "acc-1",
  accountType: "TRANSACTION",
  displayName: "Everyday Account",
  currency: "GBP",
  accountNumber: { number: "12345678", sortCode: "01-02-03" },
  provider: { providerId: "mock-bank", displayName: "Mock Bank" },
};

const SECOND_ACCOUNT: Account = {
  ...ACCOUNT,
  accountId: "acc-2",
  accountType: "SAVINGS",
  displayName: "Rainy Day",
};

const TRANSACTION: Transaction = {
  transactionId: "txn-1",
  timestamp: "2026-06-29T10:00:00.000Z",
  description: "Coffee",
  amount: "-3.5",
  currency: "GBP",
  transactionType: "DEBIT",
  transactionCategory: "PURCHASE",
  transactionClassification: [],
};

const BALANCE: Balance = { currency: "GBP", available: "90.25", current: "100.5" };

const REQUESTED_AT = new Date("2026-07-01T00:00:00.000Z");

function createContext(overrides: Partial<ConnectorSyncContext> = {}): ConnectorSyncContext {
  return {
    connectionId: "conn-1",
    userId: "user-1",
    environment: "sandbox",
    credentials: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2027-01-01T00:00:00.000Z",
    },
    requestedAt: REQUESTED_AT,
    ...overrides,
  };
}

function createConnector(
  overrides: {
    accounts?: Account[] | Error;
    transactions?: Transaction[] | Error;
    balance?: Balance | Error;
  } = {},
) {
  const client = {
    getAccounts: vi.fn(async () => {
      if (overrides.accounts instanceof Error) throw overrides.accounts;
      return overrides.accounts ?? [ACCOUNT];
    }),
    getTransactions: vi.fn(async () => {
      if (overrides.transactions instanceof Error) throw overrides.transactions;
      return overrides.transactions ?? [TRANSACTION];
    }),
    getBalance: vi.fn(async () => {
      if (overrides.balance instanceof Error) throw overrides.balance;
      return overrides.balance ?? BALANCE;
    }),
  };
  const tokenProvider = { getAccessToken: vi.fn(async () => "valid-token") };
  const connector = new TrueLayerConnector({ client, tokenProvider });
  return { connector, client, tokenProvider };
}

describe("TrueLayerConnector", () => {
  it("has a manifest that validates against ConnectorManifestSchema", () => {
    expect(() => ConnectorManifestSchema.parse(TRUELAYER_MANIFEST)).not.toThrow();
    expect(TRUELAYER_MANIFEST.auth.type).toBe("OAUTH2");
    expect(TRUELAYER_MANIFEST.providerType).toBe("BANK");
  });

  it("produces a complete ConnectorSyncResult with rawRecords", async () => {
    const { connector, tokenProvider } = createConnector();
    const result = await connector.sync(createContext());

    expect(tokenProvider.getAccessToken).toHaveBeenCalled();
    expect(result.status).toBe("success");
    expect(result.accounts).toHaveLength(1);
    expect(result.transactions).toHaveLength(1);
    expect(result.balanceSnapshots).toHaveLength(1);
    expect(result.rawRecords.length).toBeGreaterThanOrEqual(3);
    expect(result.cursors).toEqual([
      {
        resource: transactionsResource("acc-1"),
        cursor: null,
        checkpoint: REQUESTED_AT.toISOString(),
      },
    ]);
  });

  it("uses the full 90-day window when there is no cursor checkpoint", async () => {
    const { connector, client } = createConnector();
    await connector.sync(createContext());
    expect(client.getTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-04-02", to: "2026-07-01" }),
    );
  });

  it("windows incrementally from the per-account checkpoint (1-day overlap)", async () => {
    const { connector, client } = createConnector();
    await connector.sync(
      createContext({
        cursors: [
          {
            resource: transactionsResource("acc-1"),
            cursor: null,
            checkpoint: "2026-06-15T00:00:00.000Z",
          },
        ],
      }),
    );
    expect(client.getTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-06-14", to: "2026-07-01" }),
    );
  });

  it("clamps a fresh checkpoint to the 7-day default window", async () => {
    const { connector, client } = createConnector();
    await connector.sync(
      createContext({
        cursors: [
          {
            resource: transactionsResource("acc-1"),
            cursor: null,
            checkpoint: "2026-06-30T23:00:00.000Z",
          },
        ],
      }),
    );
    expect(client.getTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-06-24", to: "2026-07-01" }),
    );
  });

  it("honours the accountIds allow-list from connection metadata", async () => {
    const { connector, client } = createConnector({ accounts: [ACCOUNT, SECOND_ACCOUNT] });
    const result = await connector.sync(createContext({ metadata: { accountIds: ["acc-2"] } }));
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]?.externalId).toBe("truelayer:account:acc-2");
    expect(client.getBalance).toHaveBeenCalledTimes(1);
  });

  it("maps bank-side auth failures to ConnectorAuthError → NEEDS_REAUTH", async () => {
    const { connector } = createConnector({
      accounts: new TrueLayerAuthError("invalid_grant", "grant revoked", 401),
    });
    await expect(connector.sync(createContext())).rejects.toBeInstanceOf(ConnectorAuthError);
  });

  it("fails the whole sync when a per-account fetch hits an auth error", async () => {
    const { connector } = createConnector({
      balance: new TrueLayerAuthError("access_denied", "consent revoked", 403),
    });
    await expect(connector.sync(createContext())).rejects.toBeInstanceOf(ConnectorAuthError);
  });

  it("records non-auth per-account failures as partial results and keeps going", async () => {
    const { connector } = createConnector({
      accounts: [ACCOUNT, SECOND_ACCOUNT],
      balance: new Error("TrueLayer request failed: 500"),
    });
    const result = await connector.sync(createContext());
    expect(result.status).toBe("partial");
    expect(result.errors).toHaveLength(2);
    expect(result.transactions).toHaveLength(2);
  });

  it("maps a 429 on accounts to ConnectorRateLimitError preserving the backoff hint", async () => {
    const { connector } = createConnector({
      accounts: new TrueLayerRateLimitError(45_000),
    });
    await expect(connector.sync(createContext())).rejects.toMatchObject({
      name: "ConnectorRateLimitError",
      code: "CONNECTOR_RATE_LIMIT_ERROR",
      retryAfterMs: 45_000,
    });
  });

  it("fails the whole sync (not partial) when a per-account fetch is rate-limited", async () => {
    const { connector, client } = createConnector({
      accounts: [ACCOUNT, SECOND_ACCOUNT],
      balance: new TrueLayerRateLimitError(30_000),
    });
    await expect(connector.sync(createContext())).rejects.toBeInstanceOf(ConnectorRateLimitError);
    // The throttle covers the whole client: syncing must stop at the first
    // rate-limited account instead of hammering the remaining ones.
    expect(client.getBalance).toHaveBeenCalledTimes(1);
  });

  it("does not advance the cursor for an account whose transactions fetch failed", async () => {
    const { connector } = createConnector({
      transactions: new Error("TrueLayer request failed: 502"),
    });
    const result = await connector.sync(createContext());
    expect(result.cursors).toHaveLength(0);
    expect(result.status).toBe("partial");
  });

  it("rejects unsupported environments", async () => {
    const { connector } = createConnector();
    await expect(connector.sync(createContext({ environment: "demo" }))).rejects.toBeInstanceOf(
      ConnectorAuthError,
    );
  });

  it("testConnection authenticates via the token provider", async () => {
    const { connector, client, tokenProvider } = createConnector();
    await connector.testConnection(createContext());
    expect(tokenProvider.getAccessToken).toHaveBeenCalled();
    expect(client.getAccounts).toHaveBeenCalledWith({ accessToken: "valid-token" });
  });
});
