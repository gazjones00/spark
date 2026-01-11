import type { ContractRouterClient } from "@orpc/contract";
import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { env } from "@spark/env/web";
import { contract, type Contract } from "./contract.ts";

export type { Contract } from "./contract.ts";
export { contract } from "./contract.ts";

export type AppRouterClient = ContractRouterClient<Contract>;

export const link = new OpenAPILink(contract, {
  url: env.VITE_SERVER_URL,
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
