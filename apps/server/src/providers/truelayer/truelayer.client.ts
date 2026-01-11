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
} from "@spark/truelayer/server";
import { TRUELAYER_MODULE_OPTIONS } from "./truelayer.constants";
import type { TruelayerModuleOptions } from "./truelayer.interfaces";

@Injectable()
export class TruelayerClient implements TrueLayerClient {
  private readonly client: TrueLayerClient;

  constructor(
    @Inject(TRUELAYER_MODULE_OPTIONS)
    private readonly options: TruelayerModuleOptions,
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
}
