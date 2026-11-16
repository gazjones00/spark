import { Inject, Injectable } from "@nestjs/common";
import {
  createTrueLayerClient,
  type TrueLayerClient,
  type GenerateAuthLinkOptions,
  type AuthLinkResult,
  type ExchangeCodeOptions,
  type TokenResponse,
  type RefreshTokenOptions,
  type GetAccountsOptions,
  type Account,
  type GetTransactionsOptions,
  type Transaction,
  type GetBalanceOptions,
  type Balance,
  type RevokeAccessOptions,
  type TrueLayerConfig,
} from "@spark/truelayer/server";
import { TRUELAYER_CONFIG } from "./truelayer.config";

@Injectable()
export class TruelayerClient implements TrueLayerClient {
  private readonly client: TrueLayerClient;

  constructor(
    @Inject(TRUELAYER_CONFIG)
    private readonly options: TrueLayerConfig,
  ) {
    this.client = createTrueLayerClient(options);
  }

  generateAuthLink(options?: GenerateAuthLinkOptions): AuthLinkResult {
    return this.client.generateAuthLink(options);
  }

  exchangeCode(options: ExchangeCodeOptions): Promise<TokenResponse> {
    return this.client.exchangeCode(options);
  }

  refreshToken(options: RefreshTokenOptions): Promise<TokenResponse> {
    return this.client.refreshToken(options);
  }

  getAccounts(options: GetAccountsOptions): Promise<Account[]> {
    return this.client.getAccounts(options);
  }

  getTransactions(options: GetTransactionsOptions): Promise<Transaction[]> {
    return this.client.getTransactions(options);
  }

  getBalance(options: GetBalanceOptions): Promise<Balance> {
    return this.client.getBalance(options);
  }

  revokeAccess(options: RevokeAccessOptions): Promise<void> {
    return this.client.revokeAccess(options);
  }
}
