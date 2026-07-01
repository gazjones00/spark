import type { Account, Balance, Transaction } from "@spark/truelayer/types";
import {
  BalanceSnapshotSchema,
  FinancialAccountSchema,
  FinancialAccountType,
  FinancialTransactionSchema,
  FinancialTransactionStatus,
  FinancialTransactionType,
  type BalanceSnapshot,
  type FinancialAccount,
  type FinancialTransaction,
  type RawProviderRecord,
} from "../core/index.ts";
import { TRUELAYER_DISPLAY_NAME, TRUELAYER_PROVIDER_ID } from "./constants.ts";

export function truelayerAccountExternalId(accountId: string): string {
  return `${TRUELAYER_PROVIDER_ID}:account:${accountId}`;
}

export function truelayerTransactionExternalId(transactionId: string): string {
  return `${TRUELAYER_PROVIDER_ID}:txn:${transactionId}`;
}

/** Recovers the TrueLayer account id from a canonical account externalId. */
export function truelayerAccountIdFromExternalId(externalId: string): string {
  return externalId.replace(`${TRUELAYER_PROVIDER_ID}:account:`, "");
}

/**
 * TrueLayer banking account types folded into the canonical domain. There is
 * no dedicated card type yet, so CREDIT_CARD/CHARGE_CARD map to CASH — the
 * raw type is always preserved in metadata.truelayerAccountType.
 */
function mapAccountType(accountType: Account["accountType"]): FinancialAccountType {
  switch (accountType) {
    case "TRANSACTION":
    case "BUSINESS_TRANSACTION":
    case "CREDIT_CARD":
    case "CHARGE_CARD":
      return FinancialAccountType.Cash;
    case "SAVINGS":
    case "BUSINESS_SAVINGS":
      return FinancialAccountType.Savings;
    default:
      return FinancialAccountType.Unknown;
  }
}

export function mapTrueLayerAccount(account: Account): FinancialAccount {
  return FinancialAccountSchema.parse({
    externalId: truelayerAccountExternalId(account.accountId),
    providerId: TRUELAYER_PROVIDER_ID,
    providerName: TRUELAYER_DISPLAY_NAME,
    type: mapAccountType(account.accountType),
    displayName: account.displayName,
    currency: account.currency,
    metadata: {
      truelayerAccountId: account.accountId,
      truelayerAccountType: account.accountType ?? null,
      accountNumber: account.accountNumber,
      provider: account.provider,
      updateTimestamp: account.updateTimestamp,
    },
  });
}

/**
 * Banking transactions folded into the canonical ledger: CREDIT → DEPOSIT,
 * DEBIT → WITHDRAWAL (the closest cash-flow semantics — canonical has no
 * generic debit/credit). All banking detail (category, classification,
 * merchant, running balance, provider meta, raw type) rides in metadata.
 */
export function mapTrueLayerTransaction(
  accountId: string,
  transaction: Transaction,
): FinancialTransaction {
  return FinancialTransactionSchema.parse({
    externalId: truelayerTransactionExternalId(transaction.transactionId),
    accountExternalId: truelayerAccountExternalId(accountId),
    providerId: TRUELAYER_PROVIDER_ID,
    type:
      transaction.transactionType === "CREDIT"
        ? FinancialTransactionType.Deposit
        : FinancialTransactionType.Withdrawal,
    // TrueLayer /data transactions are settled bank transactions.
    status: FinancialTransactionStatus.Settled,
    occurredAt: transaction.timestamp,
    settledAt: transaction.timestamp,
    description: transaction.description,
    amount: transaction.amount,
    currency: transaction.currency,
    instrumentExternalId: null,
    quantity: null,
    price: null,
    fees: null,
    tax: null,
    fxRate: null,
    metadata: {
      truelayerTransactionId: transaction.transactionId,
      truelayerTransactionType: transaction.transactionType,
      transactionCategory: transaction.transactionCategory,
      transactionClassification: transaction.transactionClassification,
      merchantName: transaction.merchantName ?? null,
      runningBalance: transaction.runningBalance ?? null,
      meta: transaction.meta ?? null,
      normalisedProviderTransactionId: transaction.normalisedProviderTransactionId ?? null,
      providerTransactionId: transaction.providerTransactionId ?? null,
    },
  });
}

export function mapTrueLayerBalanceSnapshot(
  accountId: string,
  balance: Balance,
  observedAt: string,
): BalanceSnapshot {
  return BalanceSnapshotSchema.parse({
    accountExternalId: truelayerAccountExternalId(accountId),
    providerId: TRUELAYER_PROVIDER_ID,
    currency: balance.currency,
    cash: balance.current,
    availableCash: balance.available ?? null,
    blockedCash: null,
    invested: null,
    total: balance.current,
    observedAt: balance.updateTimestamp ?? observedAt,
    metadata: {
      overdraft: balance.overdraft ?? null,
      creditLimit: balance.creditLimit ?? null,
      lastStatementBalance: balance.lastStatementBalance ?? null,
      lastStatementDate: balance.lastStatementDate ?? null,
      paymentDue: balance.paymentDue ?? null,
      paymentDueDate: balance.paymentDueDate ?? null,
    },
  });
}

export function createTrueLayerRawRecord(
  resource: string,
  externalId: string,
  observedAt: string,
  payload: unknown,
): RawProviderRecord {
  return {
    providerId: TRUELAYER_PROVIDER_ID,
    resource,
    externalId,
    observedAt,
    payload: isRecord(payload) ? payload : { value: payload },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
