import {
  TrueLayerApiAccountsResponseSchema,
  TrueLayerApiBalanceResponseSchema,
  TrueLayerApiBalanceSchema,
  TrueLayerApiCardsResponseSchema,
  TrueLayerApiTransactionsResponseSchema,
  TrueLayerErrorResponseSchema,
  TrueLayerTokenResponseSchema,
} from "@spark/schema";
import {
  type TrueLayerConfig,
  type GenerateAuthLinkOptions,
  type AuthLinkResult,
  type ExchangeCodeOptions,
  type TokenResponse,
  type RefreshTokenOptions,
  type GetAccountsOptions,
  type Account,
  type AccountType,
  type GetTransactionsOptions,
  type Transaction,
  type GetBalanceOptions,
  type Balance,
} from "./types.ts";
import { getEnvironmentUrls, DEFAULT_SCOPES, DEFAULT_PROVIDERS } from "./config.ts";
import { TrueLayerError, TrueLayerAuthError, isTrueLayerAuthCode } from "./errors.ts";
import type { TrueLayerErrorCode } from "./types.ts";

type TrueLayerResourceType = "accounts" | "cards";

/**
 * Classifies a non-OK response from a TrueLayer *data* endpoint
 * (accounts/cards/transactions/balance) and throws the appropriate error.
 *
 * - HTTP 401/403 → `TrueLayerAuthError`, regardless of whether the body parses
 *   as a `TrueLayerErrorResponse`. A live-token 401 is how a bank-side consent
 *   revocation surfaces, so it must be terminal, not a transient retry.
 * - A parsed OAuth error whose code is an auth/consent code → `TrueLayerAuthError`.
 * - Everything else (429, 5xx, `invalid_request`, `server_error`, unparseable
 *   bodies) → the existing transient `TrueLayerError` / generic `Error`.
 *
 * This is intentionally scoped to data endpoints: the token endpoints
 * (exchangeCode/refreshToken) keep their original behaviour because refresh
 * failures are funnelled through the connection service's token error types.
 */
function throwDataEndpointError(status: number, data: unknown): never {
  const errorResult = TrueLayerErrorResponseSchema.safeParse(data);
  const parsed = errorResult.success ? errorResult.data : undefined;

  if (status === 401 || status === 403) {
    const code = (parsed?.error as TrueLayerErrorCode | undefined) ?? "access_denied";
    throw new TrueLayerAuthError(code, parsed?.error_description, status);
  }

  if (parsed) {
    if (isTrueLayerAuthCode(parsed.error)) {
      throw new TrueLayerAuthError(
        parsed.error as TrueLayerErrorCode,
        parsed.error_description,
        status,
      );
    }
    throw TrueLayerError.fromResponse(parsed);
  }

  throw new Error(`TrueLayer request failed: ${status}`);
}

/**
 * Reads a response body without throwing. Error responses (especially 401/403
 * from a revoked consent) frequently arrive with an empty or non-JSON body, so
 * calling `response.json()` directly would throw a `SyntaxError` and mask the
 * status the classifier needs. Returns `undefined` when the body is empty or
 * not valid JSON.
 */
async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * TrueLayer error code returned when a provider does not expose a given data
 * endpoint at all. Card-only providers (e.g. Amex) answer `/data/v1/accounts`
 * with this; account-only providers answer `/data/v1/cards` with it. It means
 * "this connection has none of this resource type", not a failure.
 */
const ENDPOINT_NOT_SUPPORTED = "endpoint_not_supported";

function isEndpointNotSupported(data: unknown): boolean {
  const parsed = TrueLayerErrorResponseSchema.safeParse(data);
  return parsed.success && parsed.data.error === ENDPOINT_NOT_SUPPORTED;
}

/**
 * Outcome of reading one data endpoint that a connection may or may not expose:
 * - `data`   — HTTP OK; `body` holds the parsed JSON.
 * - `absent` — the provider does not support this endpoint (`endpoint_not_supported`).
 * - `error`  — a genuine failure (network reject, 401/403, 5xx, …). `raise()`
 *   throws it with the correct classification, deferred so the caller can prefer
 *   whichever endpoint actually carries this connection's data.
 */
type DataEndpointOutcome =
  | { kind: "data"; body: unknown }
  | { kind: "absent" }
  | { kind: "error"; raise: () => never };

async function classifyDataEndpoint(
  settled: PromiseSettledResult<Response>,
): Promise<DataEndpointOutcome> {
  if (settled.status === "rejected") {
    const { reason } = settled;
    console.error("TrueLayer data endpoint fetch failed", reason);
    return {
      kind: "error",
      raise: () => {
        throw reason;
      },
    };
  }

  const response = settled.value;
  if (response.ok) {
    return { kind: "data", body: await response.json() };
  }

  const errorBody = await safeJson(response);
  if (isEndpointNotSupported(errorBody)) {
    return { kind: "absent" };
  }

  const { status } = response;
  return { kind: "error", raise: () => throwDataEndpointError(status, errorBody) };
}

function getResourceType(accountType?: AccountType | null): TrueLayerResourceType {
  return accountType === "CREDIT_CARD" || accountType === "CHARGE_CARD" ? "cards" : "accounts";
}

function mapAccountTypeFromCardType(cardType: "CREDIT" | "CHARGE"): AccountType {
  return cardType === "CHARGE" ? "CHARGE_CARD" : "CREDIT_CARD";
}

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

      if (options.codeChallenge) {
        params.set("code_challenge", options.codeChallenge);
        params.set("code_challenge_method", "S256");
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

      if (options.codeVerifier) {
        body.set("code_verifier", options.codeVerifier);
      }

      const response = await fetch(`${urls.auth}/connect/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorResult = TrueLayerErrorResponseSchema.safeParse(data);
        if (errorResult.success) {
          throw TrueLayerError.fromResponse(errorResult.data);
        }
        throw new Error(`TrueLayer request failed: ${response.status}`);
      }

      const result = TrueLayerTokenResponseSchema.parse(data);

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
        const errorResult = TrueLayerErrorResponseSchema.safeParse(data);
        if (errorResult.success) {
          throw TrueLayerError.fromResponse(errorResult.data);
        }
        throw new Error(`TrueLayer request failed: ${response.status}`);
      }

      const result = TrueLayerTokenResponseSchema.parse(data);

      return {
        accessToken: result.access_token,
        expiresIn: result.expires_in,
        tokenType: result.token_type,
        refreshToken: result.refresh_token ?? null,
        expiresAt: new Date(Date.now() + result.expires_in * 1000),
      };
    },

    async getAccounts(options: GetAccountsOptions): Promise<Account[]> {
      const [accountsSettled, cardsSettled] = await Promise.allSettled([
        fetch(`${urls.api}/data/v1/accounts`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${options.accessToken}`,
          },
        }),
        fetch(`${urls.api}/data/v1/cards`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${options.accessToken}`,
          },
        }),
      ]);

      const accountsOutcome = await classifyDataEndpoint(accountsSettled);
      const cardsOutcome = await classifyDataEndpoint(cardsSettled);

      // A connection can hold accounts, cards, or both, and a provider that lacks
      // one endpoint answers it with `endpoint_not_supported`. Only when *neither*
      // endpoint yielded data do we surface a failure — that way a card-only
      // provider (Amex) syncs on cards alone, while a genuine outage or a revoked
      // consent (401/403) is never silently flattened into "zero accounts".
      if (accountsOutcome.kind !== "data" && cardsOutcome.kind !== "data") {
        if (accountsOutcome.kind === "error") {
          accountsOutcome.raise();
        }
        if (cardsOutcome.kind === "error") {
          cardsOutcome.raise();
        }
        // Both endpoints are `absent`: the connection genuinely has neither.
        return [];
      }

      const accountsResults =
        accountsOutcome.kind === "data"
          ? TrueLayerApiAccountsResponseSchema.parse(accountsOutcome.body).results
          : [];
      const cardsResults =
        cardsOutcome.kind === "data"
          ? TrueLayerApiCardsResponseSchema.parse(cardsOutcome.body).results
          : [];

      const accounts = accountsResults.map((account) => ({
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

      const cards = cardsResults.map((card) => ({
        updateTimestamp: card.update_timestamp,
        accountId: card.account_id,
        accountType: mapAccountTypeFromCardType(card.card_type),
        displayName: card.display_name,
        currency: card.currency,
        accountNumber: {
          number: card.partial_card_number,
        },
        provider: {
          providerId: card.provider.provider_id,
          logoUri: card.provider.logo_uri,
          displayName: card.provider.display_name,
        },
      }));

      return [...accounts, ...cards];
    },

    async getTransactions(options: GetTransactionsOptions): Promise<Transaction[]> {
      const resourceType = getResourceType(options.accountType);
      const url = new URL(`${urls.api}/data/v1/${resourceType}/${options.accountId}/transactions`);

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

      if (!response.ok) {
        throwDataEndpointError(response.status, await safeJson(response));
      }

      const data = await response.json();
      const result = TrueLayerApiTransactionsResponseSchema.parse(data);

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
              cardNumber: transaction.meta.cardNumber,
              location: transaction.meta.location,
              supplementaryCardId: transaction.meta.supplementary_card_id,
            }
          : undefined,
      }));
    },

    async getBalance(options: GetBalanceOptions): Promise<Balance> {
      const resourceType = getResourceType(options.accountType);
      const response = await fetch(
        `${urls.api}/data/v1/${resourceType}/${options.accountId}/balance`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${options.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throwDataEndpointError(response.status, await safeJson(response));
      }

      const data = await response.json();
      const result = TrueLayerApiBalanceResponseSchema.parse(data);

      if (result.results.length === 0) {
        throw new Error("No balance data returned from TrueLayer");
      }

      const balance = TrueLayerApiBalanceSchema.parse(result.results[0]);

      return {
        currency: balance.currency,
        available: balance.available,
        current: balance.current,
        overdraft: balance.overdraft,
        creditLimit: balance.credit_limit,
        lastStatementBalance: balance.last_statement_balance,
        lastStatementDate: balance.last_statement_date,
        paymentDue: balance.payment_due,
        paymentDueDate: balance.payment_due_date,
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

export { TrueLayerError, TrueLayerAuthError, isTrueLayerAuthCode } from "./errors.ts";
