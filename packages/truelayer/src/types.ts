import type {
  AccountsResponse as SchemaAccountsResponse,
  AuthLinkResponse,
  BalanceResponse as SchemaBalanceResponse,
  TransactionsResponse as SchemaTransactionsResponse,
  TrueLayerErrorResponse as SchemaTrueLayerErrorResponse,
} from "@spark/schema";

export type {
  Account,
  AccountNumber,
  AccountProvider,
  Balance,
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
  /** PKCE code challenge (Base64Url encoded SHA256 hash of code_verifier) */
  codeChallenge?: string;
}

export type AuthLinkResult = AuthLinkResponse;

export interface ExchangeCodeOptions {
  code: string;
  /** PKCE code verifier (required if code_challenge was used in auth link) */
  codeVerifier?: string;
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

export type TransactionsResponse = SchemaTransactionsResponse;

export type AccountsResponse = SchemaAccountsResponse;

export interface GetBalanceOptions {
  accessToken: string;
  accountId: string;
}

export type BalanceResponse = SchemaBalanceResponse;

export type TrueLayerErrorResponse = SchemaTrueLayerErrorResponse;

export type TrueLayerErrorCode =
  | "invalid_client"
  | "invalid_grant"
  | "invalid_request"
  | "unauthorized_client"
  | "access_denied"
  | "server_error";
