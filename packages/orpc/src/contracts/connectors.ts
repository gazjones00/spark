import { oc } from "@orpc/contract";
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
    .input(SyncConnectorConnectionInputSchema)
    .output(SyncConnectorConnectionResponseSchema),
});
