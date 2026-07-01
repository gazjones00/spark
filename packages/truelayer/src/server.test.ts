import { afterEach, describe, expect, it, vi } from "vitest";
import { createTrueLayerClient } from "./server.ts";
import { TrueLayerAuthError, TrueLayerError } from "./errors.ts";

const client = createTrueLayerClient({
  environment: "production",
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "https://example.com/callback",
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createTrueLayerClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges cards into the accounts result with card account types", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/data/v1/accounts")) {
        return Promise.resolve(
          jsonResponse({
            results: [
              {
                update_timestamp: "2026-01-01T00:00:00.000Z",
                account_id: "account-id",
                account_type: "TRANSACTION",
                display_name: "Current Account",
                currency: "GBP",
                account_number: { number: "12345678", sortCode: "112233" },
                provider: { provider_id: "bank", display_name: "Bank" },
              },
            ],
            status: "Succeeded",
          }),
        );
      }

      return Promise.resolve(
        jsonResponse({
          results: [
            {
              update_timestamp: "2026-01-01T00:00:00.000Z",
              account_id: "credit-card-id",
              card_network: "VISA",
              card_type: "CREDIT",
              display_name: "Credit Card",
              currency: "GBP",
              partial_card_number: "1234",
              provider: { provider_id: "bank" },
            },
            {
              update_timestamp: "2026-01-01T00:00:00.000Z",
              account_id: "charge-card-id",
              card_network: "AMEX",
              card_type: "CHARGE",
              display_name: "Charge Card",
              currency: "GBP",
              partial_card_number: "5678",
              provider: { provider_id: "bank" },
            },
          ],
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const accounts = await client.getAccounts({ accessToken: "token" });

    expect(accounts.map((account) => [account.accountId, account.accountType])).toEqual([
      ["account-id", "TRANSACTION"],
      ["credit-card-id", "CREDIT_CARD"],
      ["charge-card-id", "CHARGE_CARD"],
    ]);
    expect(accounts[1]?.accountNumber.number).toBe("1234");
  });

  it("returns only bank accounts when the cards fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/data/v1/accounts")) {
        return Promise.resolve(
          jsonResponse({
            results: [
              {
                update_timestamp: "2026-01-01T00:00:00.000Z",
                account_id: "account-id",
                account_type: "TRANSACTION",
                display_name: "Current Account",
                currency: "GBP",
                account_number: { number: "12345678", sortCode: "112233" },
                provider: { provider_id: "bank", display_name: "Bank" },
              },
            ],
            status: "Succeeded",
          }),
        );
      }

      return Promise.reject(new Error("cards request failed"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const accounts = await client.getAccounts({ accessToken: "token" });

    expect(accounts.map((account) => [account.accountId, account.accountType])).toEqual([
      ["account-id", "TRANSACTION"],
    ]);
  });

  it("returns only cards when the provider does not support the accounts endpoint (e.g. Amex)", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/data/v1/accounts")) {
        // Card-only providers answer /accounts with endpoint_not_supported.
        return Promise.resolve(
          jsonResponse(
            {
              error: "endpoint_not_supported",
              error_description: "Feature not supported by the provider",
            },
            501,
          ),
        );
      }

      if (url.endsWith("/data/v1/cards")) {
        return Promise.resolve(
          jsonResponse({
            results: [
              {
                update_timestamp: "2026-01-01T00:00:00.000Z",
                account_id: "amex-card-id",
                card_network: "AMEX",
                card_type: "CHARGE",
                display_name: "Amex Card",
                currency: "GBP",
                partial_card_number: "5678",
                provider: { provider_id: "amex" },
              },
            ],
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const accounts = await client.getAccounts({ accessToken: "token" });

    expect(accounts.map((account) => [account.accountId, account.accountType])).toEqual([
      ["amex-card-id", "CHARGE_CARD"],
    ]);
  });

  it("corrects TrueLayer's broken Amex logo_uri and passes other logos through", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/data/v1/accounts")) {
        return Promise.resolve(jsonResponse({ error: "endpoint_not_supported" }, 501));
      }

      return Promise.resolve(
        jsonResponse({
          results: [
            {
              update_timestamp: "2026-01-01T00:00:00.000Z",
              account_id: "amex-card-id",
              card_network: "AMEX",
              card_type: "CHARGE",
              display_name: "Amex Card",
              currency: "GBP",
              partial_card_number: "5678",
              provider: {
                provider_id: "ob-amex",
                display_name: "American Express",
                logo_uri:
                  "https://truelayer-client-logos.s3-eu-west-1.amazonaws.com/banks/banks-icons/ob-amex-icon.svg",
              },
            },
          ],
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const accounts = await client.getAccounts({ accessToken: "token" });

    expect(accounts[0]?.provider.logoUri).toBe(
      "https://truelayer-client-logos.s3-eu-west-1.amazonaws.com/banks/banks-icons/amex-icon.svg",
    );
  });

  it("returns an empty list when neither endpoint is supported", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ error: "endpoint_not_supported" }, 501))),
    );

    const accounts = await client.getAccounts({ accessToken: "token" });

    expect(accounts).toEqual([]);
  });

  it("surfaces a card-endpoint failure when accounts is unsupported (cards is the sole source)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/data/v1/accounts")) {
        return Promise.resolve(jsonResponse({ error: "endpoint_not_supported" }, 501));
      }
      if (url.endsWith("/data/v1/cards")) {
        return Promise.resolve(
          jsonResponse({ error: "access_denied", error_description: "consent revoked" }, 403),
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.getAccounts({ accessToken: "token" })).rejects.toBeInstanceOf(
      TrueLayerAuthError,
    );
  });

  it("raises a revoked-consent error even when the other endpoint returns 200 with no rows", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/data/v1/accounts")) {
        // Some providers answer with 200 and an empty set rather than a 4xx.
        return Promise.resolve(jsonResponse({ results: [], status: "Succeeded" }));
      }
      if (url.endsWith("/data/v1/cards")) {
        return Promise.resolve(
          jsonResponse({ error: "access_denied", error_description: "consent revoked" }, 403),
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.getAccounts({ accessToken: "token" })).rejects.toBeInstanceOf(
      TrueLayerAuthError,
    );
  });

  it("uses the card transaction endpoint and preserves cardNumber metadata", async () => {
    const fetchMock = vi.fn((_: RequestInfo | URL) =>
      Promise.resolve(
        jsonResponse({
          results: [
            {
              transaction_id: "transaction-id",
              timestamp: "2026-01-01T00:00:00.000Z",
              description: "Card purchase",
              amount: 12.34,
              currency: "GBP",
              transaction_type: "DEBIT",
              transaction_category: "PURCHASE",
              running_balance: { amount: 100, currency: "GBP" },
              meta: {
                cardNumber: "1234********5678",
                location: "INTERNET",
              },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const transactions = await client.getTransactions({
      accessToken: "token",
      accountId: "credit-card-id",
      accountType: "CREDIT_CARD",
      from: "2026-01-01",
      to: "2026-01-02",
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/data/v1/cards/credit-card-id/transactions",
    );
    expect(transactions[0]?.meta?.cardNumber).toBe("1234********5678");
  });

  it("maps creditLimit separately from overdraft for card balances", async () => {
    const fetchMock = vi.fn((_: RequestInfo | URL) =>
      Promise.resolve(
        jsonResponse({
          results: [
            {
              currency: "GBP",
              available: 3279,
              current: 20,
              credit_limit: 3300,
              last_statement_balance: 226,
              last_statement_date: "2026-01-28",
              payment_due: 5,
              payment_due_date: "2026-02-24",
              update_timestamp: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const balance = await client.getBalance({
      accessToken: "token",
      accountId: "credit-card-id",
      accountType: "CREDIT_CARD",
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/data/v1/cards/credit-card-id/balance");
    expect(balance.overdraft).toBeUndefined();
    expect(balance.creditLimit).toBe(3300);
    expect(balance.paymentDueDate).toBe("2026-02-24");
  });
});

describe("createTrueLayerClient data-endpoint error classification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Each endpoint is exercised against the same set of upstream failures so the
  // classification lives in one shared place and behaves identically.
  const endpoints = {
    getAccounts: () => client.getAccounts({ accessToken: "token" }),
    getTransactions: () =>
      client.getTransactions({
        accessToken: "token",
        accountId: "acc-1",
        from: "2026-01-01",
        to: "2026-01-02",
      }),
    getBalance: () => client.getBalance({ accessToken: "token", accountId: "acc-1" }),
  } as const;

  type Expectation = "auth" | "generic";

  // `rawBody` sends the response verbatim (empty/non-JSON) instead of JSON; this
  // is the revoked-consent case where the body can't be parsed, so the status
  // alone must drive classification.
  const cases: Array<{
    name: string;
    status: number;
    body?: unknown;
    rawBody?: string;
    expect: Expectation;
    code?: string;
  }> = [
    { name: "401 with empty body", status: 401, rawBody: "", expect: "auth" },
    {
      name: "401 with non-JSON (HTML) body",
      status: 401,
      rawBody: "<html>Unauthorized</html>",
      expect: "auth",
    },
    { name: "403 with empty body", status: 403, rawBody: "", expect: "auth" },
    {
      name: "401 with JSON that does not match the error schema",
      status: 401,
      body: { message: "nope" },
      expect: "auth",
    },
    {
      name: "400 access_denied",
      status: 400,
      body: { error: "access_denied", error_description: "consent revoked" },
      expect: "auth",
      code: "access_denied",
    },
    {
      name: "400 invalid_grant",
      status: 400,
      body: { error: "invalid_grant" },
      expect: "auth",
      code: "invalid_grant",
    },
    {
      name: "400 invalid_request",
      status: 400,
      body: { error: "invalid_request" },
      expect: "generic",
    },
    { name: "429 with empty body", status: 429, rawBody: "", expect: "generic" },
    { name: "500 server error", status: 500, body: {}, expect: "generic" },
  ];

  for (const endpointName of Object.keys(endpoints) as Array<keyof typeof endpoints>) {
    for (const testCase of cases) {
      it(`${endpointName}: ${testCase.name} → ${testCase.expect}`, async () => {
        // getAccounts fans out to /accounts + /cards; a non-ok cards response is
        // simply treated as empty, so returning the failure for every URL still
        // exercises the primary-accounts classification.
        vi.spyOn(console, "error").mockImplementation(() => {});
        const response =
          testCase.rawBody !== undefined
            ? new Response(testCase.rawBody, { status: testCase.status })
            : jsonResponse(testCase.body, testCase.status);
        vi.stubGlobal(
          "fetch",
          vi.fn(() => Promise.resolve(response.clone())),
        );

        const error = await endpoints[endpointName]().then(
          () => {
            throw new Error("expected the call to reject");
          },
          (caught: unknown) => caught,
        );

        if (testCase.expect === "auth") {
          expect(error).toBeInstanceOf(TrueLayerAuthError);
          expect((error as TrueLayerAuthError).status).toBe(testCase.status);
          if (testCase.code) {
            expect((error as TrueLayerAuthError).code).toBe(testCase.code);
          }
        } else {
          expect(error).not.toBeInstanceOf(TrueLayerAuthError);
          if (testCase.code) {
            // A parseable non-auth OAuth error keeps the typed TrueLayerError.
            expect(error).toBeInstanceOf(TrueLayerError);
            expect((error as TrueLayerError).code).toBe(testCase.code);
          }
        }
      });
    }
  }
});
