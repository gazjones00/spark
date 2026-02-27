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

export const AccountTypeSchema = z
  .enum([
    AccountType.TRANSACTION,
    AccountType.SAVINGS,
    AccountType.BUSINESS_TRANSACTION,
    AccountType.BUSINESS_SAVINGS,
  ])
  .meta({ id: "AccountType" });

export const CurrencySchema = z
  .enum([Currency.EUR, Currency.GBP, Currency.USD, Currency.AUD])
  .meta({ id: "Currency" });

export const TransactionTypeSchema = z
  .enum([TransactionType.DEBIT, TransactionType.CREDIT])
  .meta({ id: "TransactionType" });

export const TransactionCategorySchema = z
  .enum([
    TransactionCategory.ATM,
    TransactionCategory.BILL_PAYMENT,
    TransactionCategory.CASH,
    TransactionCategory.CASHBACK,
    TransactionCategory.CHEQUE,
    TransactionCategory.CORRECTION,
    TransactionCategory.CREDIT,
    TransactionCategory.DIRECT_DEBIT,
    TransactionCategory.DIVIDEND,
    TransactionCategory.FEE_CHARGE,
    TransactionCategory.INTEREST,
    TransactionCategory.OTHER,
    TransactionCategory.PURCHASE,
    TransactionCategory.STANDING_ORDER,
    TransactionCategory.TRANSFER,
    TransactionCategory.DEBIT,
    TransactionCategory.UNKNOWN,
  ])
  .meta({ id: "TransactionCategory" });

export type AccountType = z.infer<typeof AccountTypeSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type TransactionType = z.infer<typeof TransactionTypeSchema>;
export type TransactionCategory = z.infer<typeof TransactionCategorySchema>;

export const AccountNumberSchema = z
  .object({
    number: z.string().optional(),
    sortCode: z.string().optional(),
    swiftBic: z.string().optional(),
    iban: z.string().optional(),
    routingNumber: z.string().optional(),
    bsb: z.string().optional(),
  })
  .meta({ id: "AccountNumber" });

export type AccountNumber = z.infer<typeof AccountNumberSchema>;

export const AccountProviderSchema = z
  .object({
    providerId: z.string().optional(),
    logoUri: z.string().optional(),
    displayName: z.string().optional(),
  })
  .meta({ id: "AccountProvider" });

export type AccountProvider = z.infer<typeof AccountProviderSchema>;

export const TrueLayerAccountSchema = z
  .object({
    updateTimestamp: z.iso.datetime(),
    accountId: z.string(),
    accountType: AccountTypeSchema.optional(),
    displayName: z.string(),
    currency: CurrencySchema,
    accountNumber: AccountNumberSchema,
    provider: AccountProviderSchema,
  })
  .meta({ id: "TrueLayerAccount" });

export type TrueLayerAccount = z.infer<typeof TrueLayerAccountSchema>;

export const RunningBalanceSchema = z
  .object({
    amount: z.number(),
    currency: CurrencySchema,
  })
  .meta({ id: "RunningBalance" });

export type RunningBalance = z.infer<typeof RunningBalanceSchema>;

export const BalanceSchema = z
  .object({
    currency: CurrencySchema,
    available: z.number().optional(),
    current: z.number(),
    overdraft: z.number().optional(),
    updateTimestamp: z.iso.datetime().optional(),
  })
  .meta({ id: "Balance" });

export type Balance = z.infer<typeof BalanceSchema>;

export const TransactionMetaSchema = z
  .object({
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
  })
  .meta({ id: "TransactionMeta" });

export type TransactionMeta = z.infer<typeof TransactionMetaSchema>;

export const TransactionSchema = z
  .object({
    transactionId: z.string(),
    normalisedProviderTransactionId: z.string().optional(),
    providerTransactionId: z.string().optional(),
    timestamp: z.iso.datetime(),
    description: z.string(),
    amount: z.number(),
    currency: CurrencySchema,
    transactionType: TransactionTypeSchema,
    transactionCategory: TransactionCategorySchema,
    transactionClassification: z.array(z.string()),
    merchantName: z.string().optional(),
    runningBalance: RunningBalanceSchema.optional(),
    meta: TransactionMetaSchema.optional(),
  })
  .meta({ id: "Transaction" });

export type Transaction = z.infer<typeof TransactionSchema>;

export const AccountsResponseSchema = z
  .object({
    results: z.array(TrueLayerAccountSchema),
    status: z.string(),
  })
  .meta({ id: "AccountsResponse" });

export type AccountsResponse = z.infer<typeof AccountsResponseSchema>;

export const TransactionsResponseSchema = z
  .object({
    results: z.array(TransactionSchema),
    status: z.string(),
  })
  .meta({ id: "TransactionsResponse" });

export type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>;

export const BalanceResponseSchema = z
  .object({
    results: z.array(BalanceSchema),
    status: z.string(),
  })
  .meta({ id: "BalanceResponse" });

export type BalanceResponse = z.infer<typeof BalanceResponseSchema>;

export const AuthLinkResponseSchema = z
  .object({
    url: z.string(),
    state: z.uuid(),
  })
  .meta({ id: "AuthLinkResponse" });

export type AuthLinkResponse = z.infer<typeof AuthLinkResponseSchema>;

export const GenerateAuthLinkInputSchema = z
  .object({
    providerId: z.string().optional(),
  })
  .meta({ id: "GenerateAuthLinkInput" });

export type GenerateAuthLinkInput = z.infer<typeof GenerateAuthLinkInputSchema>;

export const ExchangeCodeInputSchema = z
  .object({
    code: z.string().min(1),
    state: z.uuid(),
  })
  .meta({ id: "ExchangeCodeInput" });

export type ExchangeCodeInput = z.infer<typeof ExchangeCodeInputSchema>;

export const ExchangeCodeResponseSchema = z
  .object({
    state: z.uuid(),
    accounts: z.array(TrueLayerAccountSchema),
  })
  .meta({ id: "ExchangeCodeResponse" });

export type ExchangeCodeResponse = z.infer<typeof ExchangeCodeResponseSchema>;

export const SaveAccountsInputSchema = z
  .object({
    state: z.uuid(),
    accountIds: z.array(z.string()),
  })
  .meta({ id: "SaveAccountsInput" });

export type SaveAccountsInput = z.infer<typeof SaveAccountsInputSchema>;

export const SaveAccountsResponseSchema = z
  .object({
    savedCount: z.int().min(0),
  })
  .meta({ id: "SaveAccountsResponse" });

export type SaveAccountsResponse = z.infer<typeof SaveAccountsResponseSchema>;

export const TruelayerCallbackQuerySchema = z
  .object({
    code: z.string().min(1),
    state: z.uuid().optional(),
  })
  .meta({ id: "TruelayerCallbackQuery" });

export type TruelayerCallbackQuery = z.infer<typeof TruelayerCallbackQuerySchema>;

export const TrueLayerTokenResponseSchema = z
  .object({
    access_token: z.string(),
    expires_in: z.int().positive(),
    token_type: z.literal("Bearer"),
    refresh_token: z.string().nullable().optional(),
  })
  .meta({ id: "TrueLayerTokenResponse" });

export type TrueLayerTokenResponse = z.infer<typeof TrueLayerTokenResponseSchema>;

export const TrueLayerErrorResponseSchema = z
  .object({
    error: z.string(),
    error_description: z.string().optional(),
  })
  .meta({ id: "TrueLayerErrorResponse" });

export type TrueLayerErrorResponse = z.infer<typeof TrueLayerErrorResponseSchema>;

export const TrueLayerApiAccountNumberSchema = z
  .object({
    number: z.string().optional(),
    sortCode: z.string().optional(),
    swiftBic: z.string().optional(),
    iban: z.string().optional(),
    routingNumber: z.string().optional(),
    bsb: z.string().optional(),
  })
  .meta({ id: "TrueLayerApiAccountNumber" });

export type TrueLayerApiAccountNumber = z.infer<typeof TrueLayerApiAccountNumberSchema>;

export const TrueLayerApiAccountProviderSchema = z
  .object({
    provider_id: z.string().optional(),
    logo_uri: z.string().optional(),
    display_name: z.string().optional(),
  })
  .meta({ id: "TrueLayerApiAccountProvider" });

export type TrueLayerApiAccountProvider = z.infer<typeof TrueLayerApiAccountProviderSchema>;

export const TrueLayerApiAccountSchema = z
  .object({
    update_timestamp: z.iso.datetime(),
    account_id: z.string(),
    account_type: AccountTypeSchema.optional(),
    display_name: z.string(),
    currency: CurrencySchema,
    account_number: TrueLayerApiAccountNumberSchema,
    provider: TrueLayerApiAccountProviderSchema,
  })
  .meta({ id: "TrueLayerApiAccount" });

export type TrueLayerApiAccount = z.infer<typeof TrueLayerApiAccountSchema>;

export const TrueLayerApiAccountsResponseSchema = z
  .object({
    results: z.array(TrueLayerApiAccountSchema),
    status: z.string(),
  })
  .meta({ id: "TrueLayerApiAccountsResponse" });

export type TrueLayerApiAccountsResponse = z.infer<typeof TrueLayerApiAccountsResponseSchema>;

export const TrueLayerApiRunningBalanceSchema = z
  .object({
    amount: z.number(),
    currency: CurrencySchema,
  })
  .meta({ id: "TrueLayerApiRunningBalance" });

export type TrueLayerApiRunningBalance = z.infer<typeof TrueLayerApiRunningBalanceSchema>;

export const TrueLayerApiTransactionMetaSchema = z
  .object({
    bank_transaction_id: z.string().optional(),
    provider_transaction_category: z.string().optional(),
    provider_reference: z.string().optional(),
    provider_merchant_name: z.string().optional(),
    provider_category: z.string().optional(),
    address: z.string().optional(),
    provider_id: z.string().optional(),
    counter_party_preferred_name: z.string().optional(),
    counter_party_iban: z.string().optional(),
    user_comments: z.string().optional(),
    debtor_account_name: z.string().optional(),
    transaction_type: z.string().optional(),
    provider_transaction_id: z.string().optional(),
    provider_source: z.string().optional(),
  })
  .meta({ id: "TrueLayerApiTransactionMeta" });

export type TrueLayerApiTransactionMeta = z.infer<typeof TrueLayerApiTransactionMetaSchema>;

export const TrueLayerApiTransactionSchema = z
  .object({
    transaction_id: z.string(),
    normalised_provider_transaction_id: z.string().optional(),
    provider_transaction_id: z.string().optional(),
    timestamp: z.iso.datetime(),
    description: z.string(),
    amount: z.number(),
    currency: CurrencySchema,
    transaction_type: TransactionTypeSchema,
    transaction_category: TransactionCategorySchema,
    transaction_classification: z.array(z.string()),
    merchant_name: z.string().optional(),
    running_balance: TrueLayerApiRunningBalanceSchema.optional(),
    meta: TrueLayerApiTransactionMetaSchema.optional(),
  })
  .meta({ id: "TrueLayerApiTransaction" });

export type TrueLayerApiTransaction = z.infer<typeof TrueLayerApiTransactionSchema>;

export const TrueLayerApiTransactionsResponseSchema = z
  .object({
    results: z.array(TrueLayerApiTransactionSchema),
    status: z.string(),
  })
  .meta({ id: "TrueLayerApiTransactionsResponse" });

export type TrueLayerApiTransactionsResponse = z.infer<
  typeof TrueLayerApiTransactionsResponseSchema
>;

export const TrueLayerApiBalanceSchema = z
  .object({
    currency: CurrencySchema,
    available: z.number().optional(),
    current: z.number(),
    overdraft: z.number().optional(),
    update_timestamp: z.iso.datetime().optional(),
  })
  .meta({ id: "TrueLayerApiBalance" });

export type TrueLayerApiBalance = z.infer<typeof TrueLayerApiBalanceSchema>;

export const TrueLayerApiBalanceResponseSchema = z
  .object({
    results: z.array(TrueLayerApiBalanceSchema),
    status: z.string(),
  })
  .meta({ id: "TrueLayerApiBalanceResponse" });

export type TrueLayerApiBalanceResponse = z.infer<typeof TrueLayerApiBalanceResponseSchema>;
