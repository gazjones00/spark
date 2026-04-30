import { Injectable, Logger } from "@nestjs/common";
import { ConnectorSyncService } from "../modules/connectors";
import { Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";

export interface ConnectorSyncJobData {
  connectionId: string;
  userId?: string;
  requestedAt?: string;
}

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class ConnectorSyncJob {
  private readonly logger = new Logger(ConnectorSyncJob.name);

  constructor(private readonly connectorSyncService: ConnectorSyncService) {}

  @Process(Jobs.ConnectorSync)
  async handle(data: ConnectorSyncJobData): Promise<void> {
    const requestedAt = data.requestedAt ? new Date(data.requestedAt) : new Date();

    this.logger.log(`Starting connector sync for connection ${data.connectionId}`);

    const result = await this.connectorSyncService.syncConnection({
      connectionId: data.connectionId,
      userId: data.userId,
      requestedAt,
    });

    this.logger.log(
      `Connector sync completed for connection ${data.connectionId}: status=${result.syncResult.status}, recordsRead=${result.recordsRead}, recordsWritten=${result.recordsWritten}`,
    );
  }
}
