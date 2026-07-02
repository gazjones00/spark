import { Injectable, Logger } from "@nestjs/common";
import { ConnectorRateLimitError } from "@spark/connectors";
import type { z } from "zod";
import { ConnectorSyncService } from "../modules/connectors";
import { Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";
import { ConnectorSyncJobDataSchema } from "../modules/message-queue/job-schemas";

export type ConnectorSyncJobData = z.infer<typeof ConnectorSyncJobDataSchema>;

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class ConnectorSyncJob {
  private readonly logger = new Logger(ConnectorSyncJob.name);

  constructor(private readonly connectorSyncService: ConnectorSyncService) {}

  @Process(Jobs.ConnectorSync)
  async handle(data: ConnectorSyncJobData): Promise<void> {
    const requestedAt = data.requestedAt ? new Date(data.requestedAt) : new Date();

    this.logger.log(`Starting connector sync for connection ${data.connectionId}`);

    let result;
    try {
      result = await this.connectorSyncService.syncConnection({
        connectionId: data.connectionId,
        userId: data.userId,
        requestedAt,
      });
    } catch (error) {
      // Rate limits are rescheduled via the connection's nextSyncAt (set from
      // the provider's Retry-After hint during failure persistence), so the
      // job completes instead of rethrowing — a BullMQ retry on its generic
      // backoff would re-hammer an upstream that told us to back off.
      if (error instanceof ConnectorRateLimitError) {
        this.logger.warn({
          event: "provider.ratelimit.hit",
          connectionId: data.connectionId,
          retryAfterMs: error.retryAfterMs,
          msg: "Connector sync rate-limited; deferred to nextSyncAt",
        });
        return;
      }
      throw error;
    }

    this.logger.log(
      `Connector sync completed for connection ${data.connectionId}: status=${result.syncResult.status}, recordsRead=${result.recordsRead}, recordsWritten=${result.recordsWritten}`,
    );
  }
}
