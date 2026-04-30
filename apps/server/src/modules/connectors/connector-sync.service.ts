import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ConnectorError,
  emptyConnectorSyncResult,
  type ConnectorSyncContext,
  type ConnectorSyncResult,
} from "@spark/connectors";
import { and, eq, type Database } from "@spark/db";
import { connectorConnections, connectorSyncCursors } from "@spark/db/schema";
import { CryptoService } from "../crypto";
import { DATABASE_CONNECTION } from "../database";
import { ConnectorPersistenceService } from "./connector-persistence.service";
import { ConnectorRegistryService } from "./connector-registry.service";

export interface SyncConnectorConnectionInput {
  connectionId: string;
  userId?: string;
  requestedAt?: Date;
}

export interface SyncConnectorConnectionResult {
  syncResult: ConnectorSyncResult;
  syncRunId: string;
  recordsRead: number;
  recordsWritten: number;
}

@Injectable()
export class ConnectorSyncService {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly registry: ConnectorRegistryService,
    private readonly persistence: ConnectorPersistenceService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  async testConnection(input: {
    providerId: string;
    environment: string;
    userId: string;
    credentials: Record<string, string>;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const connector = this.registry.require(input.providerId);
    await connector.testConnection({
      connectionId: "test-connection",
      userId: input.userId,
      environment: input.environment,
      credentials: input.credentials,
      metadata: input.metadata,
      requestedAt: new Date(),
    });
  }

  async syncConnection(
    input: SyncConnectorConnectionInput,
  ): Promise<SyncConnectorConnectionResult> {
    const connection = await this.loadConnection(input);
    const connector = this.registry.require(connection.providerId);
    const startedAt = input.requestedAt ?? new Date();
    const context: ConnectorSyncContext = {
      connectionId: connection.id,
      userId: connection.userId,
      environment: connection.environment,
      credentials: await this.decryptCredentials(
        connection.encryptedCredentials,
        connection.credentialKeyId,
      ),
      cursors: await this.loadCursors(connection.id),
      metadata: connection.metadata,
      requestedAt: startedAt,
    };

    let syncResult: ConnectorSyncResult;
    try {
      syncResult = await connector.sync(context);
    } catch (error) {
      syncResult = this.failedSyncResult(connection.providerId, connection.id, error);
      const persisted = await this.persistence.persistSyncResult({
        userId: connection.userId,
        connectionId: connection.id,
        result: syncResult,
        startedAt,
      });
      return {
        syncResult,
        ...persisted,
      };
    }

    const persisted = await this.persistence.persistSyncResult({
      userId: connection.userId,
      connectionId: connection.id,
      result: syncResult,
      startedAt,
    });

    return {
      syncResult,
      ...persisted,
    };
  }

  private async loadConnection(input: SyncConnectorConnectionInput) {
    const conditions = [eq(connectorConnections.id, input.connectionId)];
    if (input.userId) {
      conditions.push(eq(connectorConnections.userId, input.userId));
    }

    const rows = await this.db
      .select()
      .from(connectorConnections)
      .where(and(...conditions))
      .limit(1);

    const connection = rows.at(0);
    if (!connection) {
      throw new NotFoundException("Connector connection not found.");
    }
    return connection;
  }

  private failedSyncResult(
    providerId: string,
    connectionId: string,
    error: unknown,
  ): ConnectorSyncResult {
    const result = emptyConnectorSyncResult(providerId, connectionId);
    result.status = "failed";
    result.errors.push({
      code: error instanceof ConnectorError ? error.code : "CONNECTOR_SYNC_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
    return result;
  }

  private async decryptCredentials(
    encryptedCredentials: string,
    credentialKeyId: string,
  ): Promise<Record<string, string>> {
    const plaintext = await this.cryptoService.decryptFromString(
      encryptedCredentials,
      credentialKeyId,
    );
    try {
      const parsed = JSON.parse(plaintext) as unknown;
      if (!isStringRecord(parsed)) {
        throw new Error("Connector credentials must be a string record.");
      }
      return parsed;
    } catch (error) {
      throw new BadRequestException("Stored connector credentials are invalid.", {
        cause: error,
      });
    }
  }

  private async loadCursors(connectionId: string) {
    const rows = await this.db
      .select()
      .from(connectorSyncCursors)
      .where(eq(connectorSyncCursors.connectionId, connectionId));

    return rows.map((row) => ({
      resource: row.resource,
      cursor: row.cursor,
      checkpoint: row.checkpoint,
      metadata: row.metadata,
    }));
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}
