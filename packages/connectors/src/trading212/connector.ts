import {
  emptyConnectorSyncResult,
  ConnectorAuthError,
  FinancialAccountType,
  type ConnectorSyncContext,
  type ConnectorSyncResult,
  type FinancialConnector,
} from "../core/index.ts";
import { Trading212Client, type Trading212Credentials } from "./client.ts";
import {
  TRADING212_ENVIRONMENTS,
  TRADING212_MANIFEST,
  TRADING212_PROVIDER_ID,
  type Trading212Environment,
} from "./constants.ts";
import {
  createTrading212RawRecord,
  trading212CashTransactionCheckpoint,
  trading212CashTransactionExternalId,
  trading212DividendCheckpoint,
  trading212DividendExternalId,
  trading212HistoricalOrderCheckpoint,
  trading212HistoricalOrderExternalId,
  mapTrading212AccountWithType,
  mapTrading212BalanceSnapshot,
  mapTrading212CashTransaction,
  mapTrading212DividendTransaction,
  mapTrading212Holding,
  mapTrading212Instrument,
  mapTrading212OrderTransaction,
  mapTrading212PortfolioSnapshot,
} from "./mappers.ts";

const PAGINATED_RESOURCES = {
  orders: "history-orders",
  dividends: "history-dividends",
  transactions: "history-transactions",
} as const;

export class Trading212Connector implements FinancialConnector {
  readonly manifest = TRADING212_MANIFEST;

  async testConnection(context: ConnectorSyncContext): Promise<void> {
    await this.client(context).testConnection();
  }

  async sync(context: ConnectorSyncContext): Promise<ConnectorSyncResult> {
    const observedAt = (context.requestedAt ?? new Date()).toISOString();
    const client = this.client(context);
    const result = emptyConnectorSyncResult(TRADING212_PROVIDER_ID, context.connectionId);

    const accountSummary = await client.getAccountSummary();
    const positions = await client.getPositions();
    const instruments = await client.getInstruments();
    const orders = await this.collectPages(
      PAGINATED_RESOURCES.orders,
      context,
      (nextPagePath) => client.getHistoricalOrders({ limit: 50, nextPagePath }),
      trading212HistoricalOrderCheckpoint,
    );
    const dividends = await this.collectPages(
      PAGINATED_RESOURCES.dividends,
      context,
      (nextPagePath) => client.getDividends({ limit: 50, nextPagePath }),
      trading212DividendCheckpoint,
    );
    const transactions = await this.collectPages(
      PAGINATED_RESOURCES.transactions,
      context,
      (nextPagePath) => client.getHistoricalTransactions({ limit: 50, nextPagePath }),
      trading212CashTransactionCheckpoint,
    );

    result.accounts.push(mapTrading212AccountWithType(accountSummary, this.accountType(context)));
    result.balanceSnapshots.push(mapTrading212BalanceSnapshot(accountSummary, observedAt));
    result.portfolioSnapshots.push(mapTrading212PortfolioSnapshot(accountSummary, observedAt));

    const instrumentByExternalId = new Map(
      instruments.map((instrument) => {
        const mapped = mapTrading212Instrument(instrument);
        return [mapped.externalId, mapped] as const;
      }),
    );

    for (const position of positions) {
      const mapped = mapTrading212Instrument(position.instrument);
      instrumentByExternalId.set(mapped.externalId, mapped);
      result.holdings.push(mapTrading212Holding(accountSummary, position, observedAt));
    }

    for (const order of orders.items) {
      if (order.order.instrument) {
        const mapped = mapTrading212Instrument(order.order.instrument);
        instrumentByExternalId.set(mapped.externalId, mapped);
      }
      result.transactions.push(mapTrading212OrderTransaction(accountSummary, order));
    }

    for (const dividend of dividends.items) {
      if (dividend.instrument) {
        const mapped = mapTrading212Instrument(dividend.instrument);
        instrumentByExternalId.set(mapped.externalId, mapped);
      }
      result.transactions.push(mapTrading212DividendTransaction(accountSummary, dividend));
    }

    for (const transaction of transactions.items) {
      result.transactions.push(mapTrading212CashTransaction(accountSummary, transaction));
    }

    result.instruments.push(...instrumentByExternalId.values());
    result.rawRecords.push(
      createTrading212RawRecord(
        "account-summary",
        String(accountSummary.id),
        observedAt,
        accountSummary,
      ),
      ...positions.map((position) =>
        createTrading212RawRecord("positions", position.instrument.ticker, observedAt, position),
      ),
      ...instruments.map((instrument) =>
        createTrading212RawRecord("instruments", instrument.ticker, observedAt, instrument),
      ),
      ...orders.items.map((order) =>
        createTrading212RawRecord(
          "history-orders",
          trading212HistoricalOrderExternalId(order),
          observedAt,
          order,
        ),
      ),
      ...dividends.items.map((dividend) =>
        createTrading212RawRecord(
          "history-dividends",
          trading212DividendExternalId(dividend),
          observedAt,
          dividend,
        ),
      ),
      ...transactions.items.map((transaction) =>
        createTrading212RawRecord(
          "history-transactions",
          trading212CashTransactionExternalId(transaction),
          observedAt,
          transaction,
        ),
      ),
    );
    result.cursors.push(orders.cursor, dividends.cursor, transactions.cursor);

    return result;
  }

  private client(context: ConnectorSyncContext): Trading212Client {
    const credentials = this.credentials(context);
    if (!isTrading212Environment(context.environment)) {
      throw new ConnectorAuthError(
        `Trading 212 does not support the ${context.environment} environment.`,
      );
    }
    return new Trading212Client({ ...credentials, environment: context.environment });
  }

  private credentials(context: ConnectorSyncContext): Trading212Credentials {
    const apiKey = context.credentials.apiKey;
    const apiSecret = context.credentials.apiSecret;
    if (!apiKey || !apiSecret) {
      throw new ConnectorAuthError("Trading 212 requires apiKey and apiSecret credentials.");
    }
    return { apiKey, apiSecret };
  }

  private accountType(context: ConnectorSyncContext): FinancialAccountType {
    return context.metadata?.accountType === FinancialAccountType.StocksIsa
      ? FinancialAccountType.StocksIsa
      : FinancialAccountType.Invest;
  }

  private async collectPages<T>(
    resource: string,
    context: ConnectorSyncContext,
    fetchPage: (
      nextPagePath?: string,
      since?: string,
    ) => Promise<{ items: T[]; nextPagePath: string | null }>,
    getCheckpoint: (item: T) => string | null,
  ): Promise<{
    items: T[];
    cursor: { resource: string; cursor: string | null; checkpoint: string | null };
  }> {
    const existingCursor = context.cursors?.find((cursor) => cursor.resource === resource);
    let nextPagePath = existingCursor?.cursor ?? undefined;
    const shouldFilterByCheckpoint = !nextPagePath && Boolean(existingCursor?.checkpoint);
    const since = shouldFilterByCheckpoint ? (existingCursor?.checkpoint ?? undefined) : undefined;
    const items: T[] = [];
    const checkpoints: string[] = [];

    for (let page = 0; page < 100; page += 1) {
      const result = await fetchPage(nextPagePath, since);
      const pageCheckpoints = result.items
        .map((item) => normalizeCheckpoint(getCheckpoint(item)))
        .filter((checkpoint): checkpoint is string => checkpoint !== null);
      checkpoints.push(...pageCheckpoints);

      for (const item of result.items) {
        const itemCheckpoint = normalizeCheckpoint(getCheckpoint(item));
        if (shouldFilterByCheckpoint && itemCheckpoint && since && itemCheckpoint <= since) {
          continue;
        }
        items.push(item);
      }

      nextPagePath = result.nextPagePath ?? undefined;
      const reachedCheckpoint =
        shouldFilterByCheckpoint &&
        pageCheckpoints.length > 0 &&
        pageCheckpoints.every((checkpoint) => since && checkpoint <= since);
      if (!nextPagePath) {
        break;
      }
      if (reachedCheckpoint) {
        nextPagePath = undefined;
        break;
      }
    }

    return {
      items,
      cursor: {
        resource,
        cursor: nextPagePath ?? null,
        checkpoint: maxCheckpoint([existingCursor?.checkpoint ?? null, ...checkpoints]),
      },
    };
  }
}

function normalizeCheckpoint(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function maxCheckpoint(values: Array<string | null>): string | null {
  const normalized = values
    .map((value) => normalizeCheckpoint(value))
    .filter((value): value is string => value !== null);
  if (normalized.length === 0) {
    return null;
  }
  return normalized.sort().at(-1) ?? null;
}

function isTrading212Environment(environment: string): environment is Trading212Environment {
  return environment in TRADING212_ENVIRONMENTS;
}
