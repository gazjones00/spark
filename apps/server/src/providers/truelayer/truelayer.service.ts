import { Inject, Injectable } from "@nestjs/common";
import type { Database } from "@spark/db";
import { truelayerAccounts, truelayerConnections } from "@spark/db/schema";
import { env } from "@spark/env/server";
import { TruelayerClient } from "./truelayer.client";
import { DATABASE_CONNECTION } from "../../modules/database";

export interface GenerateAuthLinkInput {
  providerId?: string;
  userId: string;
}

export interface ExchangeCodeInput {
  code: string;
}

export interface ExchangeCodeResult {
  accessToken: string;
  expiresAt: string;
  refreshToken: string | null;
  accounts: Awaited<ReturnType<TruelayerClient["getAccounts"]>>;
}

export interface SaveAccountsInput {
  accountIds: string[];
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  userId: string;
}

export interface SaveAccountsResult {
  savedCount: number;
}

@Injectable()
export class TruelayerService {
  constructor(
    private readonly client: TruelayerClient,
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

  generateAuthLink(input: GenerateAuthLinkInput) {
    return this.client.generateAuthLink({
      providerId: input.providerId,
      state: input.userId,
    });
  }

  async exchangeCode(input: ExchangeCodeInput): Promise<ExchangeCodeResult> {
    const tokenResponse = await this.client.exchangeCode({
      code: input.code,
    });

    const accounts = await this.client.getAccounts({
      accessToken: tokenResponse.accessToken,
    });

    return {
      accessToken: tokenResponse.accessToken,
      expiresAt: tokenResponse.expiresAt.toISOString(),
      refreshToken: tokenResponse.refreshToken,
      accounts,
    };
  }

  async saveAccounts(input: SaveAccountsInput): Promise<SaveAccountsResult> {
    const { accountIds, accessToken, refreshToken, expiresAt, userId } = input;

    const accounts = await this.client.getAccounts({ accessToken });
    const accountsToSave = accounts.filter((account) => accountIds.includes(account.accountId));

    const connectionId = crypto.randomUUID();
    await this.db.insert(truelayerConnections).values({
      id: connectionId,
      userId,
      accessToken,
      refreshToken,
      expiresAt: new Date(expiresAt),
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
            },
          });
        return account;
      }),
    );

    return {
      savedCount: savedAccounts.length,
    };
  }
}
