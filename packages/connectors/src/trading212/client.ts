import {
  ConnectorAuthError,
  ConnectorError,
  ConnectorRateLimitError,
  ConnectorSchemaError,
} from "../core/index.ts";
import { TRADING212_ENVIRONMENTS, type Trading212Environment } from "./constants.ts";
import {
  Trading212AccountSummarySchema,
  Trading212InstrumentSchema,
  Trading212PaginatedDividendsSchema,
  Trading212PaginatedOrdersSchema,
  Trading212PaginatedTransactionsSchema,
  Trading212PositionSchema,
  type Trading212Dividend,
  type Trading212HistoryTransaction,
  type Trading212HistoricalOrder,
  type Trading212Instrument,
  type Trading212AccountSummary,
  type Trading212Position,
} from "./schemas.ts";

export interface Trading212Credentials {
  apiKey: string;
  apiSecret: string;
}

export interface Trading212ClientConfig extends Trading212Credentials {
  environment?: Trading212Environment;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface Trading212PageOptions {
  limit?: number;
  cursor?: string;
  nextPagePath?: string;
  time?: string;
}

export interface Trading212Page<T> {
  items: T[];
  nextPagePath: string | null;
}

export class Trading212Client {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly credentials: Trading212Credentials;

  constructor(config: Trading212ClientConfig) {
    const baseUrl =
      config.baseUrl ??
      (config.environment ? TRADING212_ENVIRONMENTS[config.environment] : undefined);
    if (!baseUrl) {
      throw new ConnectorError(
        "Trading 212 client requires an environment or baseUrl.",
        "CONNECTOR_CONFIG_ERROR",
      );
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchFn = config.fetch ?? fetch;
    this.credentials = {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
    };
  }

  async testConnection(): Promise<void> {
    await this.getAccountSummary();
  }

  async getAccountSummary(): Promise<Trading212AccountSummary> {
    return this.request("/equity/account/summary", Trading212AccountSummarySchema.parse);
  }

  async getPositions(): Promise<Trading212Position[]> {
    return this.request("/equity/positions", (payload) =>
      Trading212PositionSchema.array().parse(payload),
    );
  }

  async getInstruments(): Promise<Trading212Instrument[]> {
    return this.request("/equity/metadata/instruments", (payload) =>
      Trading212InstrumentSchema.array().parse(payload),
    );
  }

  async getHistoricalOrders(
    options: Trading212PageOptions = {},
  ): Promise<Trading212Page<Trading212HistoricalOrder>> {
    const page = await this.getPaginated("/equity/history/orders", options, (payload) =>
      Trading212PaginatedOrdersSchema.parse(payload),
    );
    return page;
  }

  async getDividends(
    options: Trading212PageOptions = {},
  ): Promise<Trading212Page<Trading212Dividend>> {
    const page = await this.getPaginated("/equity/history/dividends", options, (payload) =>
      Trading212PaginatedDividendsSchema.parse(payload),
    );
    return page;
  }

  async getHistoricalTransactions(
    options: Trading212PageOptions = {},
  ): Promise<Trading212Page<Trading212HistoryTransaction>> {
    const page = await this.getPaginated("/equity/history/transactions", options, (payload) =>
      Trading212PaginatedTransactionsSchema.parse(payload),
    );
    return page;
  }

  private getPaginated<T>(
    path: string,
    options: Trading212PageOptions,
    parse: (payload: unknown) => Trading212Page<T>,
  ): Promise<Trading212Page<T>> {
    if (options.nextPagePath) {
      return this.request(options.nextPagePath, parse);
    }

    const params = new URLSearchParams();
    if (options.limit) {
      params.set("limit", String(Math.min(options.limit, 50)));
    }
    if (options.cursor) {
      params.set("cursor", options.cursor);
    }
    if (options.time) {
      params.set("time", options.time);
    }

    const query = params.toString();
    return this.request(query ? `${path}?${query}` : path, parse);
  }

  private async request<T>(path: string, parse: (payload: unknown) => T): Promise<T> {
    const response = await this.fetchFn(this.url(path), {
      method: "GET",
      headers: {
        Authorization: this.authorizationHeader(),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ConnectorAuthError(`Trading 212 authentication failed with ${response.status}.`);
      }
      if (response.status === 429) {
        throw new ConnectorRateLimitError("Trading 212 rate limit exceeded.");
      }
      throw new ConnectorError(`Trading 212 request failed with ${response.status}.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new ConnectorError(
        "Trading 212 returned invalid JSON.",
        "CONNECTOR_INVALID_JSON",
        error,
      );
    }

    try {
      return parse(payload);
    } catch (error) {
      throw new ConnectorSchemaError("Trading 212 response schema validation failed.", error);
    }
  }

  private url(path: string): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      const url = new URL(path);
      const baseUrl = new URL(this.baseUrl);
      if (url.origin !== baseUrl.origin) {
        throw new ConnectorError(
          "Trading 212 pagination URL origin did not match the configured API origin.",
          "CONNECTOR_INVALID_NEXT_PAGE_URL",
        );
      }
      return url.toString();
    }

    if (path.startsWith("/api/v0/")) {
      return `${this.baseUrl.replace(/\/api\/v0$/, "")}${path}`;
    }

    if (path.startsWith("/")) {
      return `${this.baseUrl}${path}`;
    }

    return `${this.baseUrl}/${path}`;
  }

  private authorizationHeader(): string {
    return `Basic ${btoa(`${this.credentials.apiKey}:${this.credentials.apiSecret}`)}`;
  }
}
