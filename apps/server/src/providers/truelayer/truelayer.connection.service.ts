import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import { type Database, eq } from "@spark/db";
import { truelayerConnections } from "@spark/db/schema";
import { TruelayerClient } from "./truelayer.client";
import { DATABASE_CONNECTION } from "../../modules/database";

type TruelayerConnection = typeof truelayerConnections.$inferSelect;

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
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  /**
   * Retrieves a connection by ID
   * @throws ConnectionNotFoundError if the connection does not exist
   */
  async getConnection(connectionId: string): Promise<TruelayerConnection> {
    const connection = await this.db.query.truelayerConnections.findFirst({
      where: eq(truelayerConnections.id, connectionId),
    });

    if (!connection) {
      throw new ConnectionNotFoundError(connectionId);
    }

    return connection;
  }

  /**
   * Returns a valid access token for the given connection, refreshing if necessary
   * @throws ConnectionNotFoundError if the connection does not exist
   * @throws TokenExpiredError if the token is expired and cannot be refreshed
   * @throws TokenRefreshError if token refresh fails
   */
  async getAccessToken(connectionId: string): Promise<string> {
    const connection = await this.getConnection(connectionId);
    return this.getValidAccessToken(connection);
  }

  private async getValidAccessToken(connection: TruelayerConnection): Promise<string> {
    if (connection.expiresAt >= new Date()) {
      return connection.accessToken;
    }

    if (!connection.refreshToken) {
      throw new TokenExpiredError(connection.id);
    }

    this.logger.log(`Refreshing token for connection ${connection.id}`);

    let tokenResponse;
    try {
      tokenResponse = await this.truelayerClient.refreshToken({
        refreshToken: connection.refreshToken,
      });
    } catch (error) {
      throw new TokenRefreshError(connection.id, error instanceof Error ? error : undefined);
    }

    await this.db
      .update(truelayerConnections)
      .set({
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt: tokenResponse.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(truelayerConnections.id, connection.id));

    return tokenResponse.accessToken;
  }
}
