import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  CreateConnectorConnectionInputSchema,
  CreateConnectorConnectionResponseSchema,
  DeleteConnectorConnectionInputSchema,
  DeleteConnectorConnectionResponseSchema,
  ListConnectorConnectionsResponseSchema,
  ListConnectorsResponseSchema,
  SyncConnectorConnectionInputSchema,
  SyncConnectorConnectionResponseSchema,
  TestConnectorConnectionInputSchema,
  TestConnectorConnectionResponseSchema,
} from "@spark/connectors";

export const connectorsRouter = oc.router({
  list: oc
    .route({
      method: "GET",
      path: "/connectors",
    })
    .output(ListConnectorsResponseSchema),

  testConnection: oc
    .route({
      method: "POST",
      path: "/connectors/test",
    })
    .input(TestConnectorConnectionInputSchema)
    .output(TestConnectorConnectionResponseSchema),

  createConnection: oc
    .route({
      method: "POST",
      path: "/connectors/connections",
    })
    .input(CreateConnectorConnectionInputSchema)
    .output(CreateConnectorConnectionResponseSchema),

  listConnections: oc
    .route({
      method: "GET",
      path: "/connectors/connections",
    })
    .output(ListConnectorConnectionsResponseSchema),

  deleteConnection: oc
    .route({
      method: "DELETE",
      path: "/connectors/connections/{connectionId}",
    })
    .input(DeleteConnectorConnectionInputSchema)
    .output(DeleteConnectorConnectionResponseSchema),

  syncConnection: oc
    .route({
      method: "POST",
      path: "/connectors/connections/{connectionId}/sync",
    })
    // Typed error channels so the web can branch structurally (via
    // isDefinedError) instead of string-matching error.message. The codes
    // mirror the connector error taxonomy in @spark/connectors/core/errors.
    .errors({
      NEEDS_REAUTH: {
        status: 403,
        message: "This connection needs to be reauthorised.",
        data: z.object({
          connectionId: z.string(),
          provider: z.string().optional(),
        }),
      },
      RATE_LIMITED: {
        status: 429,
        message: "The provider is rate limiting requests. Try again later.",
        data: z.object({ retryAfterSeconds: z.number().optional() }).optional(),
      },
      CONNECTOR_ERROR: {
        status: 502,
        message: "The connector failed to sync.",
        data: z.object({ code: z.string() }).optional(),
      },
    })
    .input(SyncConnectorConnectionInputSchema)
    .output(SyncConnectorConnectionResponseSchema),
});
