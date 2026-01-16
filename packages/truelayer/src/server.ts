import { z } from "zod";
import {
  type TrueLayerConfig,
  type GenerateAuthLinkOptions,
  type AuthLinkResult,
  type ExchangeCodeOptions,
  type TokenResponse,
  type RefreshTokenOptions,
  type GetAccountsOptions,
  type Account,
  type GetTransactionsOptions,
  type Transaction,
  type GetBalanceOptions,
  type Balance,
  Currency,
  AccountType,
  TransactionCategory,
  TransactionType,
} from "./types.ts";
import { getEnvironmentUrls, DEFAULT_SCOPES, DEFAULT_PROVIDERS } from "./config.ts";
import { TrueLayerError } from "./errors.ts";
import { enumValues } from "@spark/common";

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  token_type: z.literal("Bearer"),
  refresh_token: z.string().nullable().optional(),
});

const errorResponseSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

const accountNumberSchema = z.object({
  number: z.string().optional(),
  sortCode: z.string().optional(),
  swiftBic: z.string().optional(),
  iban: z.string().optional(),
  routingNumber: z.string().optional(),
  bsb: z.string().optional(),
});

const accountProviderSchema = z.object({
  provider_id: z.string().optional(),
  logo_uri: z.string().optional(),
  display_name: z.string().optional(),
});

const accountSchema = z.object({
  update_timestamp: z.string(),
  account_id: z.string(),
  account_type: z.enum(enumValues(AccountType)).optional(),
  display_name: z.string(),
  currency: z.enum(enumValues(Currency)),
  account_number: accountNumberSchema,
  provider: accountProviderSchema,
});

const accountsResponseSchema = z.object({
  results: z.array(accountSchema),
  status: z.string(),
});

const runningBalanceSchema = z.object({
  amount: z.number(),
  currency: z.enum(enumValues(Currency)),
});

const transactionMetaSchema = z.object({
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
});

const transactionSchema = z.object({
  transaction_id: z.string(),
  normalised_provider_transaction_id: z.string().optional(),
  provider_transaction_id: z.string().optional(),
  timestamp: z.string(),
  description: z.string(),
  amount: z.number(),
  currency: z.enum(enumValues(Currency)),
  transaction_type: z.enum(enumValues(TransactionType)),
  transaction_category: z.enum(enumValues(TransactionCategory)),
  transaction_classification: z.array(z.string()),
  merchant_name: z.string().optional(),
  running_balance: runningBalanceSchema.optional(),
  meta: transactionMetaSchema.optional(),
});

const transactionsResponseSchema = z.object({
  results: z.array(transactionSchema),
  status: z.string(),
});

const balanceSchema = z.object({
  currency: z.enum(enumValues(Currency)),
  available: z.number().optional(),
  current: z.number(),
  overdraft: z.number().optional(),
  update_timestamp: z.string().optional(),
});

const balanceResponseSchema = z.object({
  results: z.array(balanceSchema),
  status: z.string(),
});

export interface TrueLayerClient {
  generateAuthLink(options?: GenerateAuthLinkOptions): AuthLinkResult;
  exchangeCode(options: ExchangeCodeOptions): Promise<TokenResponse>;
  refreshToken(options: RefreshTokenOptions): Promise<TokenResponse>;
  getAccounts(options: GetAccountsOptions): Promise<Account[]>;
  getTransactions(options: GetTransactionsOptions): Promise<Transaction[]>;
  getBalance(options: GetBalanceOptions): Promise<Balance>;
}

export function createTrueLayerClient(config: TrueLayerConfig): TrueLayerClient {
  const urls = getEnvironmentUrls(config.environment);

  return {
    generateAuthLink(options: GenerateAuthLinkOptions = {}): AuthLinkResult {
      const scopes = options.scopes ?? DEFAULT_SCOPES;
      const providers = options.providers ?? DEFAULT_PROVIDERS;
      const state = options.state ?? crypto.randomUUID();

      const params = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: scopes.join(" "),
        providers,
        state,
      });

      if (options.responseMode) {
        params.set("response_mode", options.responseMode);
      }

      if (options.providerId) {
        params.set("provider_id", options.providerId);
      }

      return {
        url: `${urls.auth}/?${params.toString()}`,
        state,
      };
    },

    async exchangeCode(options: ExchangeCodeOptions): Promise<TokenResponse> {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code: options.code,
      });

      const response = await fetch(`${urls.auth}/connect/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorResult = errorResponseSchema.safeParse(data);
        if (errorResult.success) {
          throw TrueLayerError.fromResponse(errorResult.data);
        }
        throw new Error(`TrueLayer request failed: ${response.status}`);
      }

      const result = tokenResponseSchema.parse(data);

      return {
        accessToken: result.access_token,
        expiresIn: result.expires_in,
        tokenType: result.token_type,
        refreshToken: result.refresh_token ?? null,
        expiresAt: new Date(Date.now() + result.expires_in * 1000),
      };
    },

    async refreshToken(options: RefreshTokenOptions): Promise<TokenResponse> {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: options.refreshToken,
      });

      const response = await fetch(`${urls.auth}/connect/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorResult = errorResponseSchema.safeParse(data);
        if (errorResult.success) {
          throw TrueLayerError.fromResponse(errorResult.data);
        }
        throw new Error(`TrueLayer request failed: ${response.status}`);
      }

      const result = tokenResponseSchema.parse(data);

      return {
        accessToken: result.access_token,
        expiresIn: result.expires_in,
        tokenType: result.token_type,
        refreshToken: result.refresh_token ?? null,
        expiresAt: new Date(Date.now() + result.expires_in * 1000),
      };
    },

    async getAccounts(options: GetAccountsOptions): Promise<Account[]> {
      const response = await fetch(`${urls.api}/data/v1/accounts`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorResult = errorResponseSchema.safeParse(data);
        if (errorResult.success) {
          throw TrueLayerError.fromResponse(errorResult.data);
        }
        throw new Error(`TrueLayer request failed: ${response.status}`);
      }

      const result = accountsResponseSchema.parse(data);

      return result.results.map((account) => ({
        updateTimestamp: account.update_timestamp,
        accountId: account.account_id,
        accountType: account.account_type,
        displayName: account.display_name,
        currency: account.currency,
        accountNumber: account.account_number,
        provider: {
          providerId: account.provider.provider_id,
          logoUri: account.provider.logo_uri,
          displayName: account.provider.display_name,
        },
      }));
    },

    async getTransactions(options: GetTransactionsOptions): Promise<Transaction[]> {
      const url = new URL(`${urls.api}/data/v1/accounts/${options.accountId}/transactions`);

      if (options.from) {
        url.searchParams.set("from", options.from);
      }
      if (options.to) {
        url.searchParams.set("to", options.to);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorResult = errorResponseSchema.safeParse(data);
        if (errorResult.success) {
          throw TrueLayerError.fromResponse(errorResult.data);
        }
        throw new Error(`TrueLayer request failed: ${response.status}`);
      }

      const result = transactionsResponseSchema.parse(data);

      return result.results.map((transaction) => ({
        transactionId: transaction.transaction_id,
        normalisedProviderTransactionId: transaction.normalised_provider_transaction_id,
        providerTransactionId: transaction.provider_transaction_id,
        timestamp: transaction.timestamp,
        description: transaction.description,
        amount: transaction.amount,
        currency: transaction.currency,
        transactionType: transaction.transaction_type,
        transactionCategory: transaction.transaction_category,
        transactionClassification: transaction.transaction_classification,
        merchantName: transaction.merchant_name,
        runningBalance: transaction.running_balance,
        meta: transaction.meta
          ? {
              bankTransactionId: transaction.meta.bank_transaction_id,
              providerTransactionCategory: transaction.meta.provider_transaction_category,
              providerReference: transaction.meta.provider_reference,
              providerMerchantName: transaction.meta.provider_merchant_name,
              providerCategory: transaction.meta.provider_category,
              address: transaction.meta.address,
              providerId: transaction.meta.provider_id,
              counterPartyPreferredName: transaction.meta.counter_party_preferred_name,
              counterPartyIban: transaction.meta.counter_party_iban,
              userComments: transaction.meta.user_comments,
              debtorAccountName: transaction.meta.debtor_account_name,
              transactionType: transaction.meta.transaction_type,
              providerTransactionId: transaction.meta.provider_transaction_id,
              providerSource: transaction.meta.provider_source,
            }
          : undefined,
      }));
    },

    async getBalance(options: GetBalanceOptions): Promise<Balance> {
      const response = await fetch(`${urls.api}/data/v1/accounts/${options.accountId}/balance`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorResult = errorResponseSchema.safeParse(data);
        if (errorResult.success) {
          throw TrueLayerError.fromResponse(errorResult.data);
        }
        throw new Error(`TrueLayer request failed: ${response.status}`);
      }

      const result = balanceResponseSchema.parse(data);

      if (result.results.length === 0) {
        throw new Error("No balance data returned from TrueLayer");
      }

      const balance = balanceSchema.parse(result.results[0]);

      return {
        currency: balance.currency,
        available: balance.available,
        current: balance.current,
        overdraft: balance.overdraft,
        updateTimestamp: balance.update_timestamp,
      };
    },
  };
}

export type {
  TrueLayerConfig,
  TrueLayerEnvironment,
  TrueLayerScope,
  GenerateAuthLinkOptions,
  AuthLinkResult,
  ExchangeCodeOptions,
  TokenResponse,
  RefreshTokenOptions,
  GetAccountsOptions,
  AccountsResponse,
  Account,
  AccountType,
  AccountNumber,
  AccountProvider,
  Currency,
  Transaction,
  TransactionType,
  TransactionCategory,
  TransactionMeta,
  RunningBalance,
  GetTransactionsOptions,
  TransactionsResponse,
  GetBalanceOptions,
  Balance,
  BalanceResponse,
} from "./types.ts";

export { TrueLayerError } from "./errors.ts";
