import { enumValues } from "@spark/common";
import { z } from "zod";

export const TransactionCategory = {
  ATM: "ATM",
  BILL_PAYMENT: "BILL_PAYMENT",
  CASH: "CASH",
  CASHBACK: "CASHBACK",
  CHEQUE: "CHEQUE",
  CORRECTION: "CORRECTION",
  CREDIT: "CREDIT",
  DIRECT_DEBIT: "DIRECT_DEBIT",
  DIVIDEND: "DIVIDEND",
  FEE_CHARGE: "FEE_CHARGE",
  INTEREST: "INTEREST",
  OTHER: "OTHER",
  PURCHASE: "PURCHASE",
  STANDING_ORDER: "STANDING_ORDER",
  TRANSFER: "TRANSFER",
  DEBIT: "DEBIT",
  UNKNOWN: "UNKNOWN",
} as const;

export const AccountType = {
  TRANSACTION: "TRANSACTION",
  SAVINGS: "SAVINGS",
  BUSINESS_TRANSACTION: "BUSINESS_TRANSACTION",
  BUSINESS_SAVINGS: "BUSINESS_SAVINGS",
} as const;

export const Currency = {
  EUR: "EUR",
  GBP: "GBP",
  USD: "USD",
  AUD: "AUD",
} as const;

export const TransactionType = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;

export const AccountNumberSchema = z.object({
  number: z.string().optional(),
  sortCode: z.string().optional(),
  swiftBic: z.string().optional(),
  iban: z.string().optional(),
  routingNumber: z.string().optional(),
  bsb: z.string().optional(),
});

export const AccountProviderSchema = z.object({
  providerId: z.string().optional(),
  logoUri: z.string().optional(),
  displayName: z.string().optional(),
});

export const AccountTypeSchema = z.enum(enumValues(AccountType));

export const CurrencySchema = z.enum(enumValues(Currency));

export const AccountSchema = z.object({
  updateTimestamp: z.string(),
  accountId: z.string(),
  accountType: AccountTypeSchema.optional(),
  displayName: z.string(),
  currency: CurrencySchema,
  accountNumber: AccountNumberSchema,
  provider: AccountProviderSchema,
});

export const RunningBalanceSchema = z.object({
  amount: z.number(),
  currency: CurrencySchema,
});

export const TransactionTypeSchema = z.enum(enumValues(TransactionType));

export const TransactionCategorySchema = z.enum(enumValues(TransactionCategory));

export const TransactionMetaSchema = z.object({
  bankTransactionId: z.string().optional(),
  providerTransactionCategory: z.string().optional(),
  providerReference: z.string().optional(),
  providerMerchantName: z.string().optional(),
  providerCategory: z.string().optional(),
  address: z.string().optional(),
  providerId: z.string().optional(),
  counterPartyPreferredName: z.string().optional(),
  counterPartyIban: z.string().optional(),
  userComments: z.string().optional(),
  debtorAccountName: z.string().optional(),
  transactionType: z.string().optional(),
  providerTransactionId: z.string().optional(),
  providerSource: z.string().optional(),
});

export const TransactionSchema = z.object({
  transactionId: z.string(),
  normalisedProviderTransactionId: z.string().optional(),
  providerTransactionId: z.string().optional(),
  timestamp: z.string(),
  description: z.string(),
  amount: z.number(),
  currency: CurrencySchema,
  transactionType: TransactionTypeSchema,
  transactionCategory: TransactionCategorySchema,
  transactionClassification: z.array(z.string()),
  merchantName: z.string().optional(),
  runningBalance: RunningBalanceSchema.optional(),
  meta: TransactionMetaSchema.optional(),
});

export type AccountNumber = z.infer<typeof AccountNumberSchema>;
export type AccountProvider = z.infer<typeof AccountProviderSchema>;
export type AccountType = z.infer<typeof AccountTypeSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type Account = z.infer<typeof AccountSchema>;
export type RunningBalance = z.infer<typeof RunningBalanceSchema>;
export type TransactionType = z.infer<typeof TransactionTypeSchema>;
export type TransactionCategory = z.infer<typeof TransactionCategorySchema>;
export type TransactionMeta = z.infer<typeof TransactionMetaSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
