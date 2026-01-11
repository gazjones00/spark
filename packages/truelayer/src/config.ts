import type { TrueLayerEnvironment, TrueLayerScope } from "./types.ts";

export interface EnvironmentUrls {
  auth: string;
  api: string;
}

const ENVIRONMENT_URLS: Record<TrueLayerEnvironment, EnvironmentUrls> = {
  sandbox: {
    auth: "https://auth.truelayer-sandbox.com",
    api: "https://api.truelayer-sandbox.com",
  },
  production: {
    auth: "https://auth.truelayer.com",
    api: "https://api.truelayer.com",
  },
};

export function getEnvironmentUrls(environment: TrueLayerEnvironment): EnvironmentUrls {
  return ENVIRONMENT_URLS[environment];
}

export const DEFAULT_SCOPES: TrueLayerScope[] = [
  "info",
  "accounts",
  "balance",
  "transactions",
  "offline_access",
];

export const DEFAULT_PROVIDERS = "uk-ob-all";
