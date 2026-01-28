import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { eq, and, gt, type Database } from "@spark/db";
import { truelayerAccounts, truelayerOauthStates, SyncStatus } from "@spark/db/schema";
import { env } from "@spark/env/server";
import { TruelayerClient } from "./truelayer.client";
import { TruelayerConnectionService } from "./truelayer.connection.service";
import { DATABASE_CONNECTION } from "../../modules/database";
import { CryptoService } from "../../modules/crypto";
import { Jobs, MessageQueue } from "../../modules/message-queue";
import type { MessageQueueService } from "../../modules/message-queue";
import type { InitialSyncJobData } from "../../jobs/initial-sync.job";

const STATE_EXPIRY_MINUTES = 10;

export interface GenerateAuthLinkInput {
  providerId?: string;
  userId: string;
}

export interface ExchangeCodeInput {
  code: string;
  state: string;
  userId: string;
}

export interface ExchangeCodeResult {
  state: string;
  accounts: Awaited<ReturnType<TruelayerClient["getAccounts"]>>;
}

export interface SaveAccountsInput {
  state: string;
  accountIds: string[];
  userId: string;
}

export interface SaveAccountsResult {
  savedCount: number;
}

@Injectable()
export class TruelayerService {
  constructor(
    private readonly client: TruelayerClient,
    private readonly cryptoService: CryptoService,
    private readonly connectionService: TruelayerConnectionService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(`QUEUE_${MessageQueue.DEFAULT}`) private readonly queue: MessageQueueService,
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
      throw new UnauthorizedException("Invalid or expired OAuth state");
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
      throw new UnauthorizedException("Failed to store tokens - OAuth state not found");
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
      throw new UnauthorizedException("Invalid or expired OAuth state");
    }

    const oauthState = storedStates[0];

    if (!oauthState.encryptedAccessToken || !oauthState.tokenKeyId || !oauthState.tokenExpiresAt) {
      throw new UnauthorizedException(
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

    const connectionId = crypto.randomUUID();
    await this.connectionService.createConnection({
      id: connectionId,
      userId,
      accessToken,
      refreshToken,
      expiresAt: oauthState.tokenExpiresAt,
    });

    const savedAccounts = await Promise.all(
      accountsToSave.map(async (account) => {
        const id = crypto.randomUUID();
        await this.db
          .insert(truelayerAccounts)
          .values({
            id,
            accountId: account.accountId,
            connectionId,
            userId,
            accountType: account.accountType,
            displayName: account.displayName,
            currency: account.currency,
            accountNumber: account.accountNumber,
            provider: account.provider,
            updateTimestamp: new Date(account.updateTimestamp),
          })
          .onConflictDoUpdate({
            target: truelayerAccounts.accountId,
            set: {
              connectionId,
              displayName: account.displayName,
              accountType: account.accountType,
              currency: account.currency,
              accountNumber: account.accountNumber,
              provider: account.provider,
              updateTimestamp: new Date(account.updateTimestamp),
              updatedAt: new Date(),
              syncStatus: SyncStatus.OK,
            },
          });
        return account;
      }),
    );

    // Delete the oauth state row now that tokens have been used
    await this.db.delete(truelayerOauthStates).where(eq(truelayerOauthStates.state, state));

    await Promise.all(
      savedAccounts.map((account) =>
        this.queue.add<InitialSyncJobData>(Jobs.InitialSync, {
          accountId: account.accountId,
          connectionId,
        }),
      ),
    );

    return {
      savedCount: savedAccounts.length,
    };
  }
}
