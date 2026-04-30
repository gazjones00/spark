import type {
  BalanceSnapshot,
  FinancialAccount,
  FinancialTransaction,
  Holding,
  Instrument,
  PortfolioSnapshot,
} from "./financial.ts";
import type { ConnectorManifest } from "./manifest.ts";

export type ConnectorSyncStatus = "success" | "partial" | "failed";

export interface ConnectorConnection {
  id: string;
  userId: string;
  providerId: string;
  environment: string;
  encryptedCredentials: string;
  credentialKeyId: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorCursor {
  resource: string;
  cursor: string | null;
  checkpoint: string | null;
  metadata?: Record<string, unknown>;
}

export interface ConnectorSyncContext {
  connectionId: string;
  userId: string;
  environment: string;
  credentials: Record<string, string>;
  cursors?: readonly ConnectorCursor[];
  metadata?: Record<string, unknown>;
  requestedAt?: Date;
}

export interface RawProviderRecord {
  providerId: string;
  resource: string;
  externalId: string;
  observedAt: string;
  payload: Record<string, unknown>;
}

export interface ConnectorSyncResult {
  status: ConnectorSyncStatus;
  providerId: string;
  connectionId: string;
  rawRecords: RawProviderRecord[];
  accounts: FinancialAccount[];
  instruments: Instrument[];
  transactions: FinancialTransaction[];
  holdings: Holding[];
  balanceSnapshots: BalanceSnapshot[];
  portfolioSnapshots: PortfolioSnapshot[];
  cursors: ConnectorCursor[];
  errors: Array<{ code: string; message: string; resource?: string }>;
}

export interface FinancialConnector {
  readonly manifest: ConnectorManifest;
  testConnection(context: ConnectorSyncContext): Promise<void>;
  sync(context: ConnectorSyncContext): Promise<ConnectorSyncResult>;
}

export function emptyConnectorSyncResult(
  providerId: string,
  connectionId: string,
): ConnectorSyncResult {
  return {
    status: "success",
    providerId,
    connectionId,
    rawRecords: [],
    accounts: [],
    instruments: [],
    transactions: [],
    holdings: [],
    balanceSnapshots: [],
    portfolioSnapshots: [],
    cursors: [],
    errors: [],
  };
}
