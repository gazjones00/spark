import { afterEach, describe, expect, it, vi } from "vitest";
import { createTrueLayerClient } from "./server.ts";

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
