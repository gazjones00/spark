import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import { type Database, eq } from "@spark/db";
import { truelayerConnections } from "@spark/db/schema";
import { TruelayerClient } from "./truelayer.client";
import { DATABASE_CONNECTION } from "../../modules/database";
import { CryptoService } from "../../modules/crypto";

type TruelayerConnection = typeof truelayerConnections.$inferSelect;

export interface DecryptedConnection {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConnectionInput {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

export interface UpdateConnectionTokensInput {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

/**
 * Permanent errors - extend UnrecoverableError so BullMQ won't retry.
 * Use these when the failure requires user action to resolve.
 */

export class ConnectionNotFoundError extends UnrecoverableError {
  constructor(connectionId: string) {
    super(`Connection ${connectionId} not found`);
  }
}

export class TokenExpiredError extends UnrecoverableError {
  constructor(connectionId: string) {
    super(`Connection ${connectionId} expired and no refresh token available`);
  }
}

/**
 * Transient errors - regular Error so BullMQ will retry.
 * Use these for temporary failures that may succeed on retry.
 */

export class TokenRefreshError extends Error {
  constructor(connectionId: string, cause?: Error) {
    super(`Failed to refresh token for connection ${connectionId}`);
    this.name = "TokenRefreshError";
    this.cause = cause;
  }
}

@Injectable()
export class TruelayerConnectionService {
  private readonly logger = new Logger(TruelayerConnectionService.name);

  constructor(
    private readonly truelayerClient: TruelayerClient,
    private readonly cryptoService: CryptoService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  /**
   * Creates a new connection with encrypted tokens
   */
  async createConnection(input: CreateConnectionInput): Promise<void> {
    const keyId = this.cryptoService.getCurrentKeyId();
    const encryptedAccessToken = await this.cryptoService.encryptToString(input.accessToken, keyId);
    const encryptedRefreshToken = input.refreshToken
      ? await this.cryptoService.encryptToString(input.refreshToken, keyId)
      : null;

    await this.db.insert(truelayerConnections).values({
      id: input.id,
      userId: input.userId,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenKeyId: keyId,
      expiresAt: input.expiresAt,
    });
  }

  /**
   * Retrieves a connection by ID and decrypts tokens
   * @throws ConnectionNotFoundError if the connection does not exist
   */
  async getConnection(connectionId: string): Promise<DecryptedConnection> {
    const connection = await this.db.query.truelayerConnections.findFirst({
      where: eq(truelayerConnections.id, connectionId),
    });

    if (!connection) {
      throw new ConnectionNotFoundError(connectionId);
    }

    return this.decryptConnection(connection);
  }

  /**
   * Returns a valid access token for the given connection, refreshing if necessary
   * @throws ConnectionNotFoundError if the connection does not exist
   * @throws TokenExpiredError if the token is expired and cannot be refreshed
   * @throws TokenRefreshError if token refresh fails
   */
  async getAccessToken(connectionId: string): Promise<string> {
    const connection = await this.getConnection(connectionId);
    return this.getValidAccessToken(connectionId, connection);
  }

  private async decryptConnection(connection: TruelayerConnection): Promise<DecryptedConnection> {
    const accessToken = await this.cryptoService.decryptFromString(
      connection.encryptedAccessToken,
      connection.tokenKeyId,
    );
    const refreshToken = connection.encryptedRefreshToken
      ? await this.cryptoService.decryptFromString(
          connection.encryptedRefreshToken,
          connection.tokenKeyId,
        )
      : null;

    return {
      id: connection.id,
      userId: connection.userId,
      accessToken,
      refreshToken,
      expiresAt: connection.expiresAt,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  private async getValidAccessToken(
    connectionId: string,
    connection: DecryptedConnection,
  ): Promise<string> {
    if (connection.expiresAt >= new Date()) {
      return connection.accessToken;
    }

    if (!connection.refreshToken) {
      throw new TokenExpiredError(connectionId);
    }

    this.logger.log(`Refreshing token for connection ${connectionId}`);

    let tokenResponse;
    try {
      tokenResponse = await this.truelayerClient.refreshToken({
        refreshToken: connection.refreshToken,
      });
    } catch (error) {
      throw new TokenRefreshError(connectionId, error instanceof Error ? error : undefined);
    }

    await this.updateConnectionTokens(connectionId, {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresAt: tokenResponse.expiresAt,
    });

    return tokenResponse.accessToken;
  }

  private async updateConnectionTokens(
    connectionId: string,
    input: UpdateConnectionTokensInput,
  ): Promise<void> {
    const keyId = this.cryptoService.getCurrentKeyId();
    const encryptedAccessToken = await this.cryptoService.encryptToString(input.accessToken, keyId);
    const encryptedRefreshToken = input.refreshToken
      ? await this.cryptoService.encryptToString(input.refreshToken, keyId)
      : null;

    const result = await this.db
      .update(truelayerConnections)
      .set({
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenKeyId: keyId,
        expiresAt: input.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(truelayerConnections.id, connectionId))
      .returning({ id: truelayerConnections.id });

    if (result.length === 0) {
      this.logger.error(
        `Failed to persist refreshed tokens: connection ${connectionId} no longer exists`,
      );
      throw new ConnectionNotFoundError(connectionId);
    }
  }
}
