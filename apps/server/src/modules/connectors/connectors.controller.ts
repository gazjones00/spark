import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { contract } from "@spark/orpc/contract";
import { ListConnectorsResponseSchema } from "@spark/connectors";
import { ConnectorConnectionService } from "./connector-connection.service";
import { ConnectorRegistryService } from "./connector-registry.service";
import { ConnectorSyncService } from "./connector-sync.service";

@Controller()
export class ConnectorsController {
  constructor(
    private readonly registryService: ConnectorRegistryService,
    private readonly connectionService: ConnectorConnectionService,
    private readonly syncService: ConnectorSyncService,
  ) {}

  @Implement(contract.connectors.list)
  list() {
    return implement(contract.connectors.list).handler(() => {
      return ListConnectorsResponseSchema.parse({
        connectors: this.registryService.listManifests(),
      });
    });
  }

  @Implement(contract.connectors.testConnection)
  testConnection(@Session() session: UserSession) {
    return implement(contract.connectors.testConnection).handler(async ({ input }) => {
      await this.connectionService.testConnection({
        providerId: input.providerId,
        environment: input.environment,
        userId: session.user.id,
        credentials: input.credentials,
        connectionOptions: input.connectionOptions,
      });

      return { success: true as const };
    });
  }

  @Implement(contract.connectors.createConnection)
  createConnection(@Session() session: UserSession) {
    return implement(contract.connectors.createConnection).handler(async ({ input }) => {
      const connection = await this.connectionService.createConnection({
        userId: session.user.id,
        providerId: input.providerId,
        environment: input.environment,
        credentials: input.credentials,
        connectionOptions: input.connectionOptions,
      });

      return { connectionId: connection.id };
    });
  }

  @Implement(contract.connectors.syncConnection)
  syncConnection(@Session() session: UserSession) {
    return implement(contract.connectors.syncConnection).handler(async ({ input }) => {
      const result = await this.syncService.syncConnection({
        connectionId: input.connectionId,
        userId: session.user.id,
      });

      return {
        syncRunId: result.syncRunId,
        status: result.syncResult.status,
        recordsRead: result.recordsRead,
        recordsWritten: result.recordsWritten,
      };
    });
  }
}
