export type TrueLayerEnvironment = "sandbox" | "production";

export interface TrueLayerConfig {
  environment: TrueLayerEnvironment;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export type TrueLayerScope =
  | "info"
  | "accounts"
  | "balance"
  | "transactions"
  | "cards"
  | "offline_access";

export interface GenerateAuthLinkOptions {
  /** Scopes to request. Defaults to ["info", "accounts", "balance", "transactions", "offline_access"] */
  scopes?: TrueLayerScope[];
  /** Provider filter. Defaults to "uk-ob-all" */
  providers?: string;
  /** Optional state parameter for CSRF protection */
  state?: string;
  /** Optional response mode */
  responseMode?: "query" | "form_post";
  /** Optional provider ID to skip bank selection */
  providerId?: string;
}

export interface AuthLinkResult {
  url: string;
  state: string;
}

export interface ExchangeCodeOptions {
  code: string;
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
  refreshToken: string | null;
  expiresAt: Date;
}

export interface RefreshTokenOptions {
  refreshToken: string;
}

export interface GetAccountsOptions {
  accessToken: string;
}

export interface GetTransactionsOptions {
  accessToken: string;
  accountId: string;
  /** ISO 8601 date string for start of range */
  from?: string;
  /** ISO 8601 date string for end of range */
  to?: string;
}

export interface TransactionsResponse {
  results: Transaction[];
  status: string;
}

export interface AccountsResponse {
  results: Account[];
  status: string;
}

export interface TrueLayerErrorResponse {
  error: string;
  error_description?: string;
}

export type TrueLayerErrorCode =
  | "invalid_client"
  | "invalid_grant"
  | "invalid_request"
  | "unauthorized_client"
  | "access_denied"
  | "server_error";

// Account Types
export const AccountType = {
  TRANSACTION: "TRANSACTION",
  SAVINGS: "SAVINGS",
  BUSINESS_TRANSACTION: "BUSINESS_TRANSACTION",
  BUSINESS_SAVINGS: "BUSINESS_SAVINGS",
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export type Currency = "EUR" | "GBP" | "USD" | "AUD";

export interface AccountNumber {
  /** Only returned for UK accounts */
  number?: string;
  /** Only returned for UK accounts */
  sortCode?: string;
  /** ISO 9362:2009 Business Identifier Codes */
  swiftBic?: string;
  /** ISO 13616-1:2007 international bank number */
  iban?: string;
  /** Routing transit number. Only returned for US accounts */
  routingNumber?: string;
  /** BSB (Bank State Branch) number. Only returned for AU accounts */
  bsb?: string;
}

export interface AccountProvider {
  providerId?: string;
  /** @deprecated Use the providers endpoint for accurate provider data */
  logoUri?: string;
  /** @deprecated Use the providers endpoint for accurate provider data */
  displayName?: string;
}

export interface Account {
  /** Last update time of the data */
  updateTimestamp: string;
  /** Unique identifier of the account */
  accountId: string;
  /** Distinguish between personal and business, as well as savings and current accounts */
  accountType?: AccountType;
  /** Human-readable name of the account */
  displayName: string;
  /** Currency used for this account */
  currency: Currency;
  accountNumber: AccountNumber;
  provider: AccountProvider;
}

// Transaction Types

export type TransactionType = "DEBIT" | "CREDIT";

export type TransactionCategory =
  | "ATM"
  | "BILL_PAYMENT"
  | "CASH"
  | "CASHBACK"
  | "CHEQUE"
  | "CORRECTION"
  | "CREDIT"
  | "DIRECT_DEBIT"
  | "DIVIDEND"
  | "FEE_CHARGE"
  | "INTEREST"
  | "OTHER"
  | "PURCHASE"
  | "STANDING_ORDER"
  | "TRANSFER"
  | "DEBIT"
  | "UNKNOWN";

export interface RunningBalance {
  amount: number;
  currency: Currency;
}

export interface TransactionMeta {
  /** @deprecated Use top level providerTransactionId */
  bankTransactionId?: string;
  providerTransactionCategory?: string;
  providerReference?: string;
  providerMerchantName?: string;
  providerCategory?: string;
  address?: string;
  providerId?: string;
  counterPartyPreferredName?: string;
  counterPartyIban?: string;
  /** Revolut only */
  userComments?: string;
  /** Monzo only */
  debtorAccountName?: string;
  /** Amex only */
  transactionType?: string;
  /** @deprecated Starling only. Use top level providerTransactionId */
  providerTransactionId?: string;
  /** Starling only */
  providerSource?: string;
}

export interface Transaction {
  /** TrueLayer's identifier of the transaction. May change between requests */
  transactionId: string;
  /** TrueLayer's recommended identifier. Will not change between requests */
  normalisedProviderTransactionId?: string;
  /** Provider's identifier. Format varies across providers */
  providerTransactionId?: string;
  /** Date the transaction was posted on the account */
  timestamp: string;
  /** Original description as reported by the provider */
  description: string;
  /** The transaction value */
  amount: number;
  currency: Currency;
  transactionType: TransactionType;
  transactionCategory: TransactionCategory;
  /** Classification and sub-classification of the transaction */
  transactionClassification: string[];
  /** Merchant name identified in the transaction description */
  merchantName?: string;
  runningBalance?: RunningBalance;
  meta?: TransactionMeta;
}
