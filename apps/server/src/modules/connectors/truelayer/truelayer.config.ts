import type { Provider } from "@nestjs/common";
import { env } from "@spark/env/server";
import type { TrueLayerConfig } from "@spark/truelayer/server";

/** Injection token for the TrueLayer API client's configuration. */
export const TRUELAYER_CONFIG = Symbol("connectors:truelayer-config");

export const truelayerConfigProvider: Provider<TrueLayerConfig> = {
  provide: TRUELAYER_CONFIG,
  useFactory: (): TrueLayerConfig => ({
    environment: env.TRUELAYER_ENV,
    clientId: env.TRUELAYER_CLIENT_ID,
    clientSecret: env.TRUELAYER_CLIENT_SECRET,
    redirectUri: env.TRUELAYER_REDIRECT_URI,
    timeoutMs: env.PROVIDER_HTTP_TIMEOUT_MS,
  }),
};
