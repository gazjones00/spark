import { describe, expect, it } from "vitest";
import type { Account, Balance, Transaction } from "@spark/truelayer/types";
import {
  BalanceSnapshotSchema,
  FinancialAccountSchema,
  FinancialAccountType,
  FinancialTransactionSchema,
  FinancialTransactionType,
} from "../core/index.ts";
import {
  mapTrueLayerAccount,
  mapTrueLayerBalanceSnapshot,
  mapTrueLayerTransaction,
  truelayerAccountExternalId,
  truelayerAccountIdFromExternalId,
} from "./mappers.ts";

const ACCOUNT: Account = {
  updateTimestamp: "2026-06-30T12:00:00.000Z",
  accountId: "acc-1",
  accountType: "TRANSACTION",
  displayName: "Everyday Account",
  currency: "GBP",
  accountNumber: { number: "12345678", sortCode: "01-02-03" },
  provider: { providerId: "mock-bank", displayName: "Mock Bank", logoUri: "https://logo" },
};

const TRANSACTION: Transaction = {
  transactionId: "txn-1",
  normalisedProviderTransactionId: "norm-1",
  providerTransactionId: "prov-1",
  timestamp: "2026-06-29T10:00:00.000Z",
  description: "Coffee",
  amount: "-3.5",
  currency: "GBP",
  transactionType: "DEBIT",
  transactionCategory: "PURCHASE",
  transactionClassification: ["Food & Dining"],
  merchantName: "Cafe",
  runningBalance: { amount: 96.5, currency: "GBP" },
  meta: { providerTransactionId: "prov-1" },
};

const BALANCE: Balance = {
  currency: "GBP",
  available: "90.25",
  current: "100.5",
  overdraft: "250",
  updateTimestamp: "2026-06-30T11:00:00.000Z",
};

describe("TrueLayer mappers", () => {
  it("derives deterministic external ids (round-trippable)", () => {
    expect(truelayerAccountExternalId("acc-1")).toBe("truelayer:account:acc-1");
    expect(truelayerAccountIdFromExternalId("truelayer:account:acc-1")).toBe("acc-1");
  });

  it("maps accounts with type folding and full metadata preservation (AC-3)", () => {
    const account = mapTrueLayerAccount(ACCOUNT);
    expect(() => FinancialAccountSchema.parse(account)).not.toThrow();
    expect(account.type).toBe(FinancialAccountType.Cash);
    expect(account.metadata).toMatchObject({
      truelayerAccountId: "acc-1",
      truelayerAccountType: "TRANSACTION",
      accountNumber: { number: "12345678", sortCode: "01-02-03" },
      provider: { providerId: "mock-bank" },
    });
  });

  it("folds account types: savings → SAVINGS, cards → CASH with raw type kept", () => {
    expect(mapTrueLayerAccount({ ...ACCOUNT, accountType: "SAVINGS" }).type).toBe(
      FinancialAccountType.Savings,
    );
    const card = mapTrueLayerAccount({ ...ACCOUNT, accountType: "CREDIT_CARD" });
    expect(card.type).toBe(FinancialAccountType.Cash);
    expect(card.metadata.truelayerAccountType).toBe("CREDIT_CARD");
    expect(mapTrueLayerAccount({ ...ACCOUNT, accountType: undefined }).type).toBe(
      FinancialAccountType.Unknown,
    );
  });

  it("maps transactions: DEBIT → WITHDRAWAL, CREDIT → DEPOSIT, banking detail in metadata", () => {
    const debit = mapTrueLayerTransaction("acc-1", TRANSACTION);
    expect(() => FinancialTransactionSchema.parse(debit)).not.toThrow();
    expect(debit.type).toBe(FinancialTransactionType.Withdrawal);
    expect(debit.status).toBe("SETTLED");
    expect(debit.externalId).toBe("truelayer:txn:txn-1");
    expect(debit.accountExternalId).toBe("truelayer:account:acc-1");
    expect(debit.amount).toBe("-3.5");
    expect(debit.metadata).toMatchObject({
      truelayerTransactionType: "DEBIT",
      transactionCategory: "PURCHASE",
      transactionClassification: ["Food & Dining"],
      merchantName: "Cafe",
      runningBalance: { amount: 96.5, currency: "GBP" },
    });

    const credit = mapTrueLayerTransaction("acc-1", {
      ...TRANSACTION,
      transactionId: "txn-2",
      transactionType: "CREDIT",
      amount: "1250",
    });
    expect(credit.type).toBe(FinancialTransactionType.Deposit);
    expect(credit.amount).toBe("1250");
  });

  it("maps balances into snapshots (cash/available/total + card detail in metadata)", () => {
    const snapshot = mapTrueLayerBalanceSnapshot("acc-1", BALANCE, "2026-07-01T00:00:00.000Z");
    expect(() => BalanceSnapshotSchema.parse(snapshot)).not.toThrow();
    expect(snapshot).toMatchObject({
      accountExternalId: "truelayer:account:acc-1",
      cash: "100.5",
      availableCash: "90.25",
      total: "100.5",
      observedAt: "2026-06-30T11:00:00.000Z",
    });
    expect(snapshot.metadata.overdraft).toBe("250");
  });
});
