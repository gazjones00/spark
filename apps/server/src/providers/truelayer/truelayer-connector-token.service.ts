import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ConnectorAuthError,
  ConnectorError,
  type ConnectorSyncContext,
  type TrueLayerTokenProvider,
} from "@spark/connectors";
import { eq, sql, type Database } from "@spark/db";
import { connectorConnections } from "@spark/db/schema";
import { TrueLayerAuthError, type TokenResponse } from "@spark/truelayer/server";
import { CryptoService } from "../../modules/crypto";
import { DATABASE_CONNECTION } from "../../modules/database";
import { TruelayerClient } from "./truelayer.client";

/** Refresh slightly before expiry so a token never dies mid-sync. */
const EXPIRY_SKEW_MS = 60_000;

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface TrueLayerCredentialRecord {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

/**
 * Token authority for TrueLayer connections on the CONNECTOR path: reads the
 * encrypted `{ accessToken, refreshToken, expiresAt }` credential record from
 * `connector_connections`, refreshes when (nearly) expired and persists the
 * rotated record back.
 *
 * Ports the safety guarantees of the bespoke TruelayerConnectionService
 * verbatim:
 * - single-flight refresh per connection — TrueLayer rotates refresh tokens
 *   on use, so concurrent refreshes with the same token make the second fail
 *   with invalid_grant. In-process dedupe via the in-flight map; across
 *   processes via a per-connection advisory lock around the refresh;
 * - RFC 6749 §6: an omitted refresh token in the response means keep the
 *   existing one — never wipe a working refresh token.
 */
@Injectable()
export class TruelayerConnectorTokenService implements TrueLayerTokenProvider {
  private readonly logger = new Logger(TruelayerConnectorTokenService.name);
  private readonly inFlightRefreshes = new Map<string, Promise<string>>();

  constructor(
    private readonly truelayerClient: TruelayerClient,
    private readonly cryptoService: CryptoService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  async getAccessToken(context: ConnectorSyncContext): Promise<string> {
    const credentials = parseCredentialRecord(context.credentials);
    if (!isExpired(credentials)) {
      return credentials.accessToken;
    }
    if (!credentials.refreshToken) {
      throw new ConnectorAuthError(
        "TrueLayer access token has expired and no refresh token is stored.",
      );
    }

    const existing = this.inFlightRefreshes.get(context.connectionId);
    if (existing) {
      return existing;
    }

    const refresh = this.refreshAndPersist(context.connectionId, credentials).finally(() => {
      this.inFlightRefreshes.delete(context.connectionId);
    });
    this.inFlightRefreshes.set(context.connectionId, refresh);
    return refresh;
  }

  private async refreshAndPersist(
    connectionId: string,
    stale: TrueLayerCredentialRecord,
  ): Promise<string> {
    // Serialise rotation across workers on a per-connection advisory lock —
    // the in-flight map only dedupes within this process. The lock is held
    // over the TrueLayer round-trip deliberately: the rotated refresh token
    // must be persisted before any other worker is allowed to refresh, or the
    // loser burns the old token and the grant dies with invalid_grant.
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${connectionId}))`);

      // Re-read from the connection row in case another worker refreshed while
      // we waited; this also gives us the freshest refresh token to send.
      const current = (await this.loadCredentials(tx, connectionId)) ?? stale;
      if (!isExpired(current)) {
        return current.accessToken;
      }
      if (!current.refreshToken) {
        throw new ConnectorAuthError(
          "TrueLayer access token has expired and no refresh token is stored.",
        );
      }

      this.logger.log(`Refreshing TrueLayer token for connection ${connectionId}`);

      let tokenResponse: TokenResponse;
      try {
        tokenResponse = await this.truelayerClient.refreshToken({
          refreshToken: current.refreshToken,
        });
      } catch (error) {
        if (error instanceof TrueLayerAuthError) {
          // The grant is gone (revoked consent / invalid_grant) — terminal,
          // maps to NEEDS_REAUTH via the connector error taxonomy.
          throw new ConnectorAuthError(error.message, error);
        }
        throw new ConnectorError(
          `Failed to refresh TrueLayer token for connection ${connectionId}`,
          "TOKEN_REFRESH_FAILED",
          error,
        );
      }

      const next: TrueLayerCredentialRecord = {
        accessToken: tokenResponse.accessToken,
        // RFC 6749 §6: keep the existing refresh token when the response
        // doesn't rotate it.
        refreshToken: tokenResponse.refreshToken ?? current.refreshToken,
        expiresAt: tokenResponse.expiresAt.toISOString(),
      };
      await this.persistCredentials(tx, connectionId, next);
      return next.accessToken;
    });
  }

  private async loadCredentials(
    tx: DatabaseTransaction,
    connectionId: string,
  ): Promise<TrueLayerCredentialRecord | null> {
    const rows = await tx
      .select({
        encryptedCredentials: connectorConnections.encryptedCredentials,
        credentialKeyId: connectorConnections.credentialKeyId,
      })
      .from(connectorConnections)
      .where(eq(connectorConnections.id, connectionId))
      .limit(1);

    const row = rows.at(0);
    if (!row) {
      // Expected for synthetic test-connection contexts; sync contexts always
      // have a row.
      return null;
    }
    const plaintext = await this.cryptoService.decryptFromString(
      row.encryptedCredentials,
      row.credentialKeyId,
    );
    return parseCredentialRecord(JSON.parse(plaintext) as Record<string, string>);
  }

  private async persistCredentials(
    tx: DatabaseTransaction,
    connectionId: string,
    credentials: TrueLayerCredentialRecord,
  ): Promise<void> {
    const keyId = this.cryptoService.getCurrentKeyId();
    const encryptedCredentials = await this.cryptoService.encryptToString(
      JSON.stringify(credentials),
      keyId,
    );
    const updated = await tx
      .update(connectorConnections)
      .set({ encryptedCredentials, credentialKeyId: keyId, updatedAt: new Date() })
      .where(eq(connectorConnections.id, connectionId))
      .returning({ id: connectorConnections.id });

    if (updated.length === 0) {
      this.logger.warn(
        `Refreshed TrueLayer tokens for connection ${connectionId} but no row exists to persist them`,
      );
    }
  }
}

function isExpired(credentials: TrueLayerCredentialRecord): boolean {
  return new Date(credentials.expiresAt).getTime() - EXPIRY_SKEW_MS <= Date.now();
}

function parseCredentialRecord(credentials: Record<string, string>): TrueLayerCredentialRecord {
  const { accessToken, refreshToken, expiresAt } = credentials;
  if (!accessToken || !expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
    throw new ConnectorAuthError(
      "Stored TrueLayer credentials are malformed; the connection must be reauthorised.",
    );
  }
  return { accessToken, ...(refreshToken ? { refreshToken } : {}), expiresAt };
}
