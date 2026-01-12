import type { Account, Transaction } from "./schemas.ts";

export type {
  Account,
  AccountNumber,
  AccountProvider,
  RunningBalance,
  Transaction,
  TransactionMeta,
} from "./schemas.ts";

export { AccountType, Currency, TransactionType, TransactionCategory } from "./schemas.ts";

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
