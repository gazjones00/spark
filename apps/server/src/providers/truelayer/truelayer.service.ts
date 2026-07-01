import { Inject, Injectable } from "@nestjs/common";
import { TRUELAYER_PROVIDER_ID } from "@spark/connectors";
import { eq, and, gt, type Database } from "@spark/db";
import { truelayerOauthStates } from "@spark/db/schema";
import { env } from "@spark/env/server";
import type {
  ExchangeCodeInput as ExchangeCodePayload,
  ExchangeCodeResponse,
  GenerateAuthLinkInput as GenerateAuthLinkPayload,
  SaveAccountsInput as SaveAccountsPayload,
  SaveAccountsResponse,
} from "@spark/schema";
import { TruelayerClient } from "./truelayer.client";
import { DATABASE_CONNECTION } from "../../modules/database";
import { ConnectorConnectionService } from "../../modules/connectors";
import { CryptoService } from "../../modules/crypto";

const STATE_EXPIRY_MINUTES = 10;

/**
 * The OAuth state row is missing, expired, or tokenless. User-recoverable by
 * restarting the connect flow; mapped to the INVALID_OAUTH_STATE typed error
 * channel at the controller.
 */
export class InvalidOauthStateError extends Error {
  constructor(message = "Invalid or expired OAuth state") {
    super(message);
    this.name = "InvalidOauthStateError";
  }
}

export type GenerateAuthLinkInput = GenerateAuthLinkPayload & {
  userId: string;
};

export type ExchangeCodeInput = ExchangeCodePayload & {
  userId: string;
};

export type ExchangeCodeResult = ExchangeCodeResponse;

export type SaveAccountsInput = SaveAccountsPayload & {
  userId: string;
};

export type SaveAccountsResult = SaveAccountsResponse;

@Injectable()
export class TruelayerService {
  constructor(
    private readonly client: TruelayerClient,
    private readonly cryptoService: CryptoService,
    private readonly connectorConnectionService: ConnectorConnectionService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  buildCallbackRedirectUrl(code: string, state?: string): string {
    const frontendUrl = new URL("/accounts/connect", env.CORS_ORIGIN);
    frontendUrl.searchParams.set("code", code);
    if (state) {
      frontendUrl.searchParams.set("state", state);
    }
    return frontendUrl.toString();
  }

  async generateAuthLink(input: GenerateAuthLinkInput) {
    const state = crypto.randomUUID();
    const codeVerifier = this.cryptoService.generateCodeVerifier();
    const codeChallenge = await this.cryptoService.generateCodeChallenge(codeVerifier);
    const expiresAt = new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000);

    await this.db.insert(truelayerOauthStates).values({
      state,
      userId: input.userId,
      codeVerifier,
      expiresAt,
    });

    return this.client.generateAuthLink({
      providerId: input.providerId,
      state,
      codeChallenge,
    });
  }

  async exchangeCode(input: ExchangeCodeInput): Promise<ExchangeCodeResult> {
    // Validate state belongs to this user and hasn't expired
    const storedStates = await this.db
      .select()
      .from(truelayerOauthStates)
      .where(
        and(
          eq(truelayerOauthStates.state, input.state),
          eq(truelayerOauthStates.userId, input.userId),
          gt(truelayerOauthStates.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (storedStates.length === 0) {
      throw new InvalidOauthStateError();
    }

    const { codeVerifier } = storedStates[0];

    const tokenResponse = await this.client.exchangeCode({
      code: input.code,
      codeVerifier,
    });

    const accounts = await this.client.getAccounts({
      accessToken: tokenResponse.accessToken,
    });

    // Encrypt tokens and store in oauth state row (server-side only)
    const encryptedTokenData = await this.cryptoService.encryptToString(tokenResponse.accessToken);
    const tokenKeyId = this.cryptoService.getCurrentKeyId();
    const encryptedRefreshToken = tokenResponse.refreshToken
      ? await this.cryptoService.encryptToString(tokenResponse.refreshToken)
      : null;

    const updatedRows = await this.db
      .update(truelayerOauthStates)
      .set({
        encryptedAccessToken: encryptedTokenData,
        encryptedRefreshToken,
        tokenKeyId,
        tokenExpiresAt: tokenResponse.expiresAt,
        accounts,
      })
      .where(eq(truelayerOauthStates.state, input.state))
      .returning({ state: truelayerOauthStates.state });

    if (updatedRows.length === 0) {
      throw new InvalidOauthStateError("Failed to store tokens - OAuth state not found");
    }

    return {
      state: input.state,
      accounts,
    };
  }

  async saveAccounts(input: SaveAccountsInput): Promise<SaveAccountsResult> {
    const { state, accountIds, userId } = input;

    // Retrieve encrypted tokens from oauth state row
    const storedStates = await this.db
      .select()
      .from(truelayerOauthStates)
      .where(
        and(
          eq(truelayerOauthStates.state, state),
          eq(truelayerOauthStates.userId, userId),
          gt(truelayerOauthStates.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (storedStates.length === 0) {
      throw new InvalidOauthStateError();
    }

    const oauthState = storedStates[0];

    if (!oauthState.encryptedAccessToken || !oauthState.tokenKeyId || !oauthState.tokenExpiresAt) {
      throw new InvalidOauthStateError(
        "OAuth state has no tokens - code exchange may not have completed",
      );
    }

    // Decrypt tokens
    const accessToken = await this.cryptoService.decryptFromString(
      oauthState.encryptedAccessToken,
      oauthState.tokenKeyId,
    );
    const refreshToken = oauthState.encryptedRefreshToken
      ? await this.cryptoService.decryptFromString(
          oauthState.encryptedRefreshToken,
          oauthState.tokenKeyId,
        )
      : null;

    // Use accounts from the state row (already fetched during code exchange)
    const accounts = oauthState.accounts ?? [];
    const accountsToSave = accounts.filter((account) => accountIds.includes(account.accountId));

    // New connections land on the connector path (docs/adr/0001): the token
    // record becomes the encrypted connector credential blob, the selected
    // accounts become the connection's allow-list, and the connector
    // scheduler owns syncing. No truelayer_* rows are written.
    await this.connectorConnectionService.createOAuthConnection({
      userId,
      providerId: TRUELAYER_PROVIDER_ID,
      environment: env.TRUELAYER_ENV,
      credentials: {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        expiresAt: oauthState.tokenExpiresAt.toISOString(),
      },
      metadata: {
        accountIds: accountsToSave.map((account) => account.accountId),
      },
    });

    // Delete the oauth state row now that tokens have been used
    await this.db.delete(truelayerOauthStates).where(eq(truelayerOauthStates.state, state));

    return {
      savedCount: accountsToSave.length,
    };
  }
}
