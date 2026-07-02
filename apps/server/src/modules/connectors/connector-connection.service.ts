import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ConnectorAuthError,
  ConnectorAuthType,
  ConnectorError,
  type ConnectorAuthField,
  type ConnectorConnectionOption,
  type ConnectorManifest,
} from "@spark/connectors";
import { and, eq, type Database } from "@spark/db";
import { connectorConnections } from "@spark/db/schema";
import type { SyncStatusType } from "@spark/common";
import { CryptoService } from "../crypto";
import { DATABASE_CONNECTION } from "../database";
import { Jobs, MessageQueue } from "../message-queue";
import type { MessageQueueService } from "../message-queue";
import { consentExpiryFor } from "./consent-lifecycle.config";
import { ConnectorRegistryService } from "./connector-registry.service";
import { ConnectorSyncService } from "./connector-sync.service";

const INITIAL_SYNC_RESERVATION_MINUTES = 5;

export interface CreateConnectorConnectionInput {
  userId: string;
  providerId: string;
  environment: string;
  credentials: Record<string, string>;
  connectionOptions?: Record<string, unknown>;
}

export interface TestConnectorConnectionInput {
  userId: string;
  providerId: string;
  environment: string;
  credentials: Record<string, string>;
  connectionOptions?: Record<string, unknown>;
}

export interface CreateOAuthConnectionInput {
  userId: string;
  providerId: string;
  environment: string;
  /** Token record from OUR OAuth exchange — never user-supplied input. */
  credentials: Record<string, string>;
  /** Server-derived metadata, e.g. the accountIds allow-list. */
  metadata?: Record<string, unknown>;
}

export interface ConnectorConnectionSummary {
  id: string;
  providerId: string;
  providerName: string;
  environment: string;
  capabilities: string[];
  metadata: Record<string, unknown>;
  syncStatus: SyncStatusType;
  lastSyncedAt: Date | null;
  nextSyncAt: Date;
  lastSyncErrorCode: string | null;
  lastSyncErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ConnectorConnectionService {
  private readonly logger = new Logger(ConnectorConnectionService.name);

  constructor(
    private readonly registry: ConnectorRegistryService,
    private readonly syncService: ConnectorSyncService,
    private readonly cryptoService: CryptoService,
    @Inject(`QUEUE_${MessageQueue.DEFAULT}`) private readonly queue: MessageQueueService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  async createConnection(
    input: CreateConnectorConnectionInput,
  ): Promise<ConnectorConnectionSummary> {
    const { manifest, metadata, credentials } = this.validateConnectionInput(input);
    await this.verifyConnection(input, manifest, metadata, credentials);
    return this.insertConnection(input.userId, input.environment, manifest, metadata, credentials);
  }

  /**
   * Creates a connection for an OAuth2 provider whose credentials come from
   * OUR token exchange (e.g. the TrueLayer redirect flow) rather than from
   * user-entered manifest auth fields. Not exposed via the public contract:
   * the public createConnection path rejects credentials for OAUTH2 manifests
   * (they declare no auth fields), which keeps token injection impossible.
   */
  async createOAuthConnection(
    input: CreateOAuthConnectionInput,
  ): Promise<ConnectorConnectionSummary> {
    const connector = this.registry.get(input.providerId);
    if (!connector) {
      throw new NotFoundException(`Connector provider not found: ${input.providerId}`);
    }
    const manifest = connector.manifest;
    if (manifest.auth.type !== ConnectorAuthType.OAuth2) {
      throw new BadRequestException(`Provider ${manifest.id} does not use OAuth2 credentials.`);
    }
    this.assertEnvironment(manifest.environments, input.environment);

    const metadata = input.metadata ?? {};
    await this.verifyConnection(
      { ...input, connectionOptions: undefined },
      manifest,
      metadata,
      input.credentials,
    );
    return this.insertConnection(
      input.userId,
      input.environment,
      manifest,
      metadata,
      input.credentials,
    );
  }

  private async insertConnection(
    userId: string,
    environment: string,
    manifest: ConnectorManifest,
    metadata: Record<string, unknown>,
    credentials: Record<string, string>,
  ): Promise<ConnectorConnectionSummary> {
    const keyId = this.cryptoService.getCurrentKeyId();
    const encryptedCredentials = await this.cryptoService.encryptToString(
      JSON.stringify(credentials),
      keyId,
    );

    const id = crypto.randomUUID();
    const now = new Date();
    const [row] = await this.db
      .insert(connectorConnections)
      .values({
        id,
        userId,
        providerId: manifest.id,
        providerName: manifest.displayName,
        environment,
        encryptedCredentials,
        credentialKeyId: keyId,
        capabilities: [...manifest.capabilities],
        metadata,
        nextSyncAt: addMinutes(now, INITIAL_SYNC_RESERVATION_MINUTES),
        // A reconnect creates a fresh connection row, so a surviving row's
        // consent columns are always from its own grant; the warning stamp
        // starts clear. Null expiry (unknown lifetime) is never flagged.
        consentGrantedAt: now,
        consentExpiresAt: consentExpiryFor(manifest.id, now),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!row) {
      throw new InternalServerErrorException(
        `Failed to create connector connection for provider ${manifest.id} and user ${userId}.`,
      );
    }

    await this.enqueueInitialSync(row.id, row.userId, now);

    return this.toSummary(row);
  }

  async testConnection(input: TestConnectorConnectionInput): Promise<void> {
    const { manifest, metadata, credentials } = this.validateConnectionInput(input);
    await this.verifyConnection(input, manifest, metadata, credentials);
  }

  async listConnections(userId: string): Promise<ConnectorConnectionSummary[]> {
    const rows = await this.db
      .select()
      .from(connectorConnections)
      .where(eq(connectorConnections.userId, userId))
      .orderBy(connectorConnections.createdAt);
    return rows.map((row) => this.toSummary(row));
  }

  async deleteConnection(userId: string, connectionId: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(connectorConnections)
      .where(
        and(eq(connectorConnections.id, connectionId), eq(connectorConnections.userId, userId)),
      )
      .limit(1);
    const connection = rows.at(0);
    if (!connection) {
      throw new NotFoundException("Connector connection not found.");
    }

    // Revoke before deleting: the row holds the only copy of the credentials,
    // so once it is gone the grant can never be revoked. Best-effort — a
    // provider outage must never leave the user unable to delete their data.
    await this.revokeUpstreamGrant(connection);

    await this.db
      .delete(connectorConnections)
      .where(
        and(eq(connectorConnections.id, connectionId), eq(connectorConnections.userId, userId)),
      );
  }

  /**
   * Ends the provider-side authorisation behind a connection so that
   * "disconnected" also means "no longer authorised" at the provider, not
   * just locally. Never throws:
   * - providers without a grant (API-key connectors) declare no `revoke`
   *   capability and are skipped;
   * - an already-dead grant (`ConnectorAuthError`) is the goal state;
   * - any other failure is logged (message only) and deletion proceeds —
   *   the token dies upstream when the grant naturally expires.
   */
  private async revokeUpstreamGrant(
    connection: typeof connectorConnections.$inferSelect,
  ): Promise<void> {
    const connector = this.registry.get(connection.providerId);
    if (!connector?.revoke) {
      return;
    }

    try {
      const credentials = await this.decryptStoredCredentials(connection);
      await connector.revoke({
        connectionId: connection.id,
        userId: connection.userId,
        environment: connection.environment,
        credentials,
        metadata: connection.metadata,
      });
      this.logger.log(`Revoked upstream grant for connection ${connection.id}`);
    } catch (error) {
      if (error instanceof ConnectorAuthError) {
        this.logger.log(`Upstream grant already revoked for connection ${connection.id}`);
        return;
      }
      this.logger.warn(
        `Upstream revocation failed for connection ${connection.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async decryptStoredCredentials(
    connection: typeof connectorConnections.$inferSelect,
  ): Promise<Record<string, string>> {
    const plaintext = await this.cryptoService.decryptFromString(
      connection.encryptedCredentials,
      connection.credentialKeyId,
    );
    const parsed = JSON.parse(plaintext) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Stored connector credentials are not a record.");
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => {
        return typeof entry[1] === "string";
      }),
    );
  }

  private assertEnvironment(
    environments: ReadonlyArray<{ key: string }>,
    environment: string,
  ): void {
    if (!environments.some((env) => env.key === environment)) {
      throw new BadRequestException(`Unsupported environment: ${environment}`);
    }
  }

  private prepareCredentials(
    fields: readonly ConnectorAuthField[],
    credentials: Record<string, string>,
  ): Record<string, string> {
    const fieldKeys = new Set(fields.map((field) => field.key));
    for (const key of Object.keys(credentials)) {
      if (!fieldKeys.has(key)) {
        throw new BadRequestException(`Unsupported credential: ${key}`);
      }
    }

    const prepared: Record<string, string> = {};
    for (const field of fields) {
      const value = credentials[field.key];
      if (field.required && !value) {
        throw new BadRequestException(`Missing required credential: ${field.key}`);
      }
      if (value === undefined || value === "") {
        continue;
      }
      if (typeof value !== "string") {
        throw new BadRequestException(`Credential ${field.key} must be a string.`);
      }
      prepared[field.key] = value;
    }
    return prepared;
  }

  private validateConnectionInput(input: TestConnectorConnectionInput): {
    manifest: ConnectorManifest;
    metadata: Record<string, unknown>;
    credentials: Record<string, string>;
  } {
    const connector = this.registry.get(input.providerId);
    if (!connector) {
      throw new NotFoundException(`Connector provider not found: ${input.providerId}`);
    }

    const manifest = connector.manifest;
    this.assertEnvironment(manifest.environments, input.environment);
    const credentials = this.prepareCredentials(manifest.auth.fields, input.credentials);

    return {
      manifest,
      credentials,
      metadata: this.prepareConnectionMetadata(
        manifest.connectionOptions,
        input.connectionOptions ?? {},
      ),
    };
  }

  private prepareConnectionMetadata(
    fields: readonly ConnectorConnectionOption[],
    options: Record<string, unknown>,
  ): Record<string, unknown> {
    const fieldKeys = new Set(fields.map((field) => field.key));
    for (const key of Object.keys(options)) {
      if (!fieldKeys.has(key)) {
        throw new BadRequestException(`Unsupported connection option: ${key}`);
      }
    }

    const metadata: Record<string, unknown> = {};
    for (const field of fields) {
      const value = options[field.key] ?? field.defaultValue;
      if (value === undefined || value === null || value === "") {
        if (field.required) {
          throw new BadRequestException(`Missing required connection option: ${field.key}`);
        }
        continue;
      }
      if (typeof value !== "string") {
        throw new BadRequestException(`Connection option ${field.key} must be a string.`);
      }
      if (field.options && !field.options.some((option) => option.value === value)) {
        throw new BadRequestException(`Unsupported value for connection option: ${field.key}`);
      }
      metadata[field.key] = value;
    }

    return metadata;
  }

  private async verifyConnection(
    input: TestConnectorConnectionInput,
    manifest: ConnectorManifest,
    metadata: Record<string, unknown>,
    credentials: Record<string, string>,
  ): Promise<void> {
    try {
      await this.syncService.testConnection({
        providerId: manifest.id,
        environment: input.environment,
        userId: input.userId,
        credentials,
        metadata,
      });
    } catch (error) {
      if (error instanceof ConnectorAuthError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof ConnectorError) {
        throw new BadRequestException(`Failed to verify ${manifest.displayName} credentials.`);
      }
      throw error;
    }
  }

  private toSummary(row: typeof connectorConnections.$inferSelect): ConnectorConnectionSummary {
    return {
      id: row.id,
      providerId: row.providerId,
      providerName: row.providerName,
      environment: row.environment,
      capabilities: row.capabilities,
      metadata: row.metadata,
      syncStatus: row.syncStatus,
      lastSyncedAt: row.lastSyncedAt,
      nextSyncAt: row.nextSyncAt,
      lastSyncErrorCode: row.lastSyncErrorCode,
      lastSyncErrorMessage: row.lastSyncErrorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async enqueueInitialSync(
    connectionId: string,
    userId: string,
    requestedAt: Date,
  ): Promise<void> {
    try {
      await this.queue.add(
        Jobs.ConnectorSync,
        {
          connectionId,
          userId,
          requestedAt: requestedAt.toISOString(),
        },
        {
          jobId: `connector:${connectionId}:initial`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 60_000,
          },
          removeOnComplete: 1_000,
          removeOnFail: 1_000,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue initial connector sync for connection ${connectionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
