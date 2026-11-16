import type { TrueLayerAccount } from "@spark/schema";
import { describe, expect, it } from "vitest";
import {
  accountIdentityKeys,
  knownAccounts,
  planReconnect,
  type KnownAccount,
  type ReconnectCandidate,
} from "./reconnect-plan";

const OLDER = new Date("2026-01-01T00:00:00Z");
const NEWER = new Date("2026-06-01T00:00:00Z");

const CURRENT_ACCOUNT = { sortCode: "12-34-56", number: "11112222" };
const SAVINGS_ACCOUNT = { sortCode: "12-34-56", number: "33334444" };
const CARD = { number: "1234" };

function granted(
  accountId: string,
  accountNumber: TrueLayerAccount["accountNumber"],
  overrides: Partial<TrueLayerAccount> = {},
): TrueLayerAccount {
  return {
    updateTimestamp: "2026-11-01T00:00:00Z",
    accountId,
    accountType: "TRANSACTION",
    displayName: accountId,
    currency: "GBP",
    accountNumber,
    provider: { providerId: "ob-nationwide" },
    ...overrides,
  };
}

function synced(
  accountId: string,
  accountNumber: TrueLayerAccount["accountNumber"],
  accountType = "TRANSACTION",
  bank = "ob-nationwide",
): KnownAccount {
  return {
    accountId,
    synced: true,
    identityKeys: accountIdentityKeys({
      accountType,
      accountNumber,
      provider: { providerId: bank },
    }),
  };
}

function connection(
  connectionId: string,
  createdAt: Date,
  accounts: KnownAccount[],
  metadata: Record<string, unknown> = { accountIds: accounts.map((a) => a.accountId) },
): ReconnectCandidate {
  return { connectionId, createdAt, metadata, accounts };
}

describe("knownAccounts", () => {
  it("unions synced accounts with allow-listed ones that have not synced yet", () => {
    const accounts = knownAccounts({ accountIds: ["acc-1", "acc-2"] }, [
      { externalId: "truelayer:account:acc-1", metadata: { accountNumber: CURRENT_ACCOUNT } },
    ]);

    expect(accounts).toEqual([
      { accountId: "acc-1", synced: true, identityKeys: ["sort-code:123456:11112222"] },
      { accountId: "acc-2", synced: false, identityKeys: [] },
    ]);
  });

  it("recovers the account id from the external id when metadata lacks it", () => {
    const [account] = knownAccounts({}, [{ externalId: "truelayer:account:acc-1", metadata: {} }]);

    expect(account?.accountId).toBe("acc-1");
  });

  it("ignores a malformed allow-list rather than trusting its entries", () => {
    expect(knownAccounts({ accountIds: "acc-1" }, [])).toEqual([]);
    expect(knownAccounts({ accountIds: [1, null, "acc-1"] }, []).map((a) => a.accountId)).toEqual([
      "acc-1",
    ]);
  });
});

describe("accountIdentityKeys", () => {
  it("normalises sort code punctuation and IBAN spacing and case", () => {
    expect(
      accountIdentityKeys({
        accountNumber: {
          iban: "gb29 nwbk 6016 1331 9268 19",
          sortCode: "60-16-13",
          number: "31926819",
        },
      }),
    ).toEqual(["iban:GB29NWBK60161331926819", "sort-code:601613:31926819"]);
  });

  it("scopes a partial card number to the bank and account kind", () => {
    expect(
      accountIdentityKeys({
        accountType: "CREDIT_CARD",
        accountNumber: CARD,
        provider: { providerId: "ob-amex" },
      }),
    ).toEqual(["number:ob-amex:card:1234"]);
  });

  it("yields nothing it cannot pin to one bank account", () => {
    expect(accountIdentityKeys({ accountNumber: CARD })).toEqual([]);
    expect(accountIdentityKeys({ accountNumber: undefined })).toEqual([]);
    expect(accountIdentityKeys({ accountNumber: { number: "  " } })).toEqual([]);
  });
});

describe("planReconnect", () => {
  it("renews the connection holding the granted accounts, moving nothing", () => {
    const plan = planReconnect(
      [connection("conn-1", OLDER, [synced("acc-1", CURRENT_ACCOUNT)])],
      [granted("acc-1", CURRENT_ACCOUNT)],
      ["acc-1"],
    );

    expect(plan).toEqual({
      targetConnectionId: "conn-1",
      accountMoves: [],
      retiredConnectionIds: [],
      narrowedConnections: [],
    });
  });

  it("matches on the grant, so a reconnect that selects only a new account still renews", () => {
    const plan = planReconnect(
      [connection("conn-1", OLDER, [synced("acc-1", CURRENT_ACCOUNT)])],
      [granted("acc-1", CURRENT_ACCOUNT), granted("acc-2", SAVINGS_ACCOUNT)],
      ["acc-2"],
    );

    expect(plan?.targetConnectionId).toBe("conn-1");
  });

  it("treats a grant over unrelated accounts as a new connection", () => {
    const plan = planReconnect(
      [connection("conn-1", OLDER, [synced("acc-1", CURRENT_ACCOUNT)])],
      [granted("acc-9", SAVINGS_ACCOUNT)],
      ["acc-9"],
    );

    expect(plan).toBeNull();
  });

  it("returns null with no connections or an empty grant", () => {
    expect(planReconnect([], [granted("acc-1", CURRENT_ACCOUNT)], ["acc-1"])).toBeNull();
    expect(
      planReconnect([connection("conn-1", OLDER, [synced("acc-1", CURRENT_ACCOUNT)])], [], []),
    ).toBeNull();
  });

  it("prefers the widest overlap when several connections share accounts", () => {
    const plan = planReconnect(
      [
        connection("conn-narrow", OLDER, [synced("acc-1", CURRENT_ACCOUNT)]),
        connection("conn-wide", NEWER, [
          synced("acc-1", CURRENT_ACCOUNT),
          synced("acc-2", SAVINGS_ACCOUNT),
        ]),
      ],
      [granted("acc-1", CURRENT_ACCOUNT), granted("acc-2", SAVINGS_ACCOUNT)],
      ["acc-1", "acc-2"],
    );

    expect(plan?.targetConnectionId).toBe("conn-wide");
  });

  it("breaks an equal overlap on the oldest connection, then the lowest id, in any order", () => {
    const candidates = [
      connection("conn-new", NEWER, [synced("acc-1", CURRENT_ACCOUNT)]),
      connection("conn-b", OLDER, [synced("acc-1", CURRENT_ACCOUNT)]),
      connection("conn-a", OLDER, [synced("acc-1", CURRENT_ACCOUNT)]),
    ];
    const grant = [granted("acc-1", CURRENT_ACCOUNT)];

    expect(planReconnect(candidates, grant, ["acc-1"])?.targetConnectionId).toBe("conn-a");
    expect(planReconnect([...candidates].reverse(), grant, ["acc-1"])?.targetConnectionId).toBe(
      "conn-a",
    );
  });

  describe("a grant spanning two of the user's connections", () => {
    const currentAccountConnection = connection("conn-current", OLDER, [
      synced("acc-current", CURRENT_ACCOUNT),
    ]);
    const cardConnection = connection("conn-card", NEWER, [
      synced("acc-card", CARD, "CREDIT_CARD"),
    ]);
    const grant = [
      granted("acc-current", CURRENT_ACCOUNT),
      granted("acc-card", CARD, { accountType: "CREDIT_CARD" }),
    ];

    it("folds the other connection in when both accounts are selected", () => {
      const plan = planReconnect([cardConnection, currentAccountConnection], grant, [
        "acc-current",
        "acc-card",
      ]);

      expect(plan).toEqual({
        targetConnectionId: "conn-current",
        accountMoves: [
          {
            fromConnectionId: "conn-card",
            fromExternalId: "truelayer:account:acc-card",
            toExternalId: "truelayer:account:acc-card",
            cursorResources: [{ from: "transactions:acc-card", to: "transactions:acc-card" }],
          },
        ],
        retiredConnectionIds: ["conn-card"],
        narrowedConnections: [],
      });
    });

    it("renews the selected account's own connection and leaves the other alone", () => {
      const plan = planReconnect([currentAccountConnection, cardConnection], grant, ["acc-card"]);

      expect(plan).toEqual({
        targetConnectionId: "conn-card",
        accountMoves: [],
        retiredConnectionIds: [],
        narrowedConnections: [],
      });
    });

    it("narrows a source connection that keeps accounts outside the grant", () => {
      const sharedConnection = connection(
        "conn-card",
        NEWER,
        [synced("acc-card", CARD, "CREDIT_CARD"), synced("acc-savings", SAVINGS_ACCOUNT)],
        { label: "kept", accountIds: ["acc-card", "acc-savings"] },
      );

      const plan = planReconnect([currentAccountConnection, sharedConnection], grant, [
        "acc-current",
        "acc-card",
      ]);

      expect(plan?.retiredConnectionIds).toEqual([]);
      expect(plan?.narrowedConnections).toEqual([
        { connectionId: "conn-card", metadata: { label: "kept", accountIds: ["acc-savings"] } },
      ]);
    });

    it("pins a narrowed connection that had no allow-list, so it cannot resync the moved account", () => {
      const unrestricted = connection(
        "conn-card",
        NEWER,
        [synced("acc-card", CARD, "CREDIT_CARD"), synced("acc-savings", SAVINGS_ACCOUNT)],
        {},
      );

      const plan = planReconnect([currentAccountConnection, unrestricted], grant, [
        "acc-current",
        "acc-card",
      ]);

      expect(plan?.narrowedConnections).toEqual([
        { connectionId: "conn-card", metadata: { accountIds: ["acc-savings"] } },
      ]);
    });

    it("retires a source whose only account never synced, with no rows to move", () => {
      const pending = connection("conn-card", NEWER, [
        { accountId: "acc-card", synced: false, identityKeys: [] },
      ]);

      const plan = planReconnect([currentAccountConnection, pending], grant, [
        "acc-current",
        "acc-card",
      ]);

      expect(plan?.accountMoves).toEqual([]);
      expect(plan?.retiredConnectionIds).toEqual(["conn-card"]);
    });
  });

  describe("a re-issued TrueLayer account id", () => {
    it("matches on sort code and number, carrying the history to the new id", () => {
      const plan = planReconnect(
        [connection("conn-1", OLDER, [synced("acc-old", CURRENT_ACCOUNT)])],
        [granted("acc-new", CURRENT_ACCOUNT)],
        ["acc-new"],
      );

      expect(plan).toEqual({
        targetConnectionId: "conn-1",
        accountMoves: [
          {
            fromConnectionId: "conn-1",
            fromExternalId: "truelayer:account:acc-old",
            toExternalId: "truelayer:account:acc-new",
            cursorResources: [{ from: "transactions:acc-old", to: "transactions:acc-new" }],
          },
        ],
        retiredConnectionIds: [],
        narrowedConnections: [],
      });
    });

    it("matches a card on its partial number at the same bank", () => {
      const plan = planReconnect(
        [connection("conn-1", OLDER, [synced("card-old", CARD, "CREDIT_CARD", "ob-amex")])],
        [
          granted("card-new", CARD, {
            accountType: "CREDIT_CARD",
            provider: { providerId: "ob-amex" },
          }),
        ],
        ["card-new"],
      );

      expect(plan?.accountMoves.map((move) => move.toExternalId)).toEqual([
        "truelayer:account:card-new",
      ]);
    });

    it("does not match the same partial card number at a different bank", () => {
      const plan = planReconnect(
        [connection("conn-1", OLDER, [synced("card-old", CARD, "CREDIT_CARD", "ob-amex")])],
        [
          granted("card-new", CARD, {
            accountType: "CREDIT_CARD",
            provider: { providerId: "ob-barclays" },
          }),
        ],
        ["card-new"],
      );

      expect(plan).toBeNull();
    });

    it("moves and re-ids an account arriving from another connection in one step", () => {
      const plan = planReconnect(
        [
          connection("conn-current", OLDER, [synced("acc-current", CURRENT_ACCOUNT)]),
          connection("conn-savings", NEWER, [synced("acc-savings-old", SAVINGS_ACCOUNT)]),
        ],
        [granted("acc-current", CURRENT_ACCOUNT), granted("acc-savings-new", SAVINGS_ACCOUNT)],
        ["acc-current", "acc-savings-new"],
      );

      expect(plan?.accountMoves).toEqual([
        {
          fromConnectionId: "conn-savings",
          fromExternalId: "truelayer:account:acc-savings-old",
          toExternalId: "truelayer:account:acc-savings-new",
          cursorResources: [
            { from: "transactions:acc-savings-old", to: "transactions:acc-savings-new" },
          ],
        },
      ]);
      expect(plan?.retiredConnectionIds).toEqual(["conn-savings"]);
    });

    it("prefers an exact id over a bank-identifier match on the same connection", () => {
      const plan = planReconnect(
        [
          connection("conn-1", OLDER, [
            synced("acc-dup", CURRENT_ACCOUNT),
            synced("acc-1", CURRENT_ACCOUNT),
          ]),
        ],
        [granted("acc-1", CURRENT_ACCOUNT)],
        ["acc-1"],
      );

      expect(plan?.accountMoves).toEqual([]);
    });
  });
});
