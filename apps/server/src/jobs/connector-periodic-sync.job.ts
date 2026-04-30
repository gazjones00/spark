import { Inject, Injectable, Logger } from "@nestjs/common";
import { SyncStatus } from "@spark/common";
import { and, eq, inArray, lte, sql, type Database } from "@spark/db";
import { connectorConnections } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../modules/database";
import { Cron, Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";
import type { MessageQueueService } from "../modules/message-queue";
import type { ConnectorSyncJobData } from "./connector-sync.job";

const BATCH_SIZE = 100;
const SYNC_INTERVAL_MINUTES = 5;
const SCHEDULER_LOCK_KEY = 4242002;

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class ConnectorPeriodicSyncJob {
  private readonly logger = new Logger(ConnectorPeriodicSyncJob.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(`QUEUE_${MessageQueue.DEFAULT}`) private readonly queue: MessageQueueService,
  ) {}

  @Cron("*/5 * * * *")
  @Process(Jobs.ConnectorPeriodicSync)
  async handle(): Promise<void> {
    this.logger.log("Starting periodic connector sync");

    const result = await this.db.transaction(async (tx) => {
      const lockResult = await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(${SCHEDULER_LOCK_KEY}) AS locked`,
      );
      const locked = Boolean(lockResult.rows?.[0]?.locked);
      if (!locked) {
        this.logger.debug("Skipping periodic connector sync; scheduler lock not acquired");
        return null;
      }

      const now = new Date();
      const nextSyncAt = new Date(now.getTime() + SYNC_INTERVAL_MINUTES * 60 * 1000);
      nextSyncAt.setSeconds(0, 0);

      const dueConnections = await tx
        .select({
          id: connectorConnections.id,
          userId: connectorConnections.userId,
        })
        .from(connectorConnections)
        .where(
          and(
            eq(connectorConnections.syncStatus, SyncStatus.OK),
            lte(connectorConnections.nextSyncAt, now),
          ),
        )
        .orderBy(connectorConnections.nextSyncAt, connectorConnections.id)
        .limit(BATCH_SIZE);

      if (dueConnections.length === 0) {
        return { connections: [], timestamp: 0 };
      }

      await tx
        .update(connectorConnections)
        .set({ nextSyncAt, updatedAt: now })
        .where(
          inArray(
            connectorConnections.id,
            dueConnections.map((connection) => connection.id),
          ),
        );

      return { connections: dueConnections, timestamp: now.getTime() };
    });

    if (result === null) {
      return;
    }

    const { connections, timestamp } = result;
    if (connections.length === 0) {
      this.logger.log("No connector connections due for sync");
      return;
    }

    if (connections.length === BATCH_SIZE) {
      this.logger.warn(
        `Connector sync batch limit reached (${BATCH_SIZE}); some connections may be delayed`,
      );
    }

    const dispatches = await Promise.allSettled(
      connections.map((connection) =>
        this.queue.add<ConnectorSyncJobData>(
          Jobs.ConnectorSync,
          {
            connectionId: connection.id,
            userId: connection.userId,
            requestedAt: new Date(timestamp).toISOString(),
          },
          {
            jobId: `connector:${connection.id}:${timestamp}`,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 60_000,
            },
            removeOnComplete: 1_000,
            removeOnFail: 1_000,
          },
        ),
      ),
    );

    const failed = dispatches.filter((dispatch) => dispatch.status === "rejected");
    if (failed.length > 0) {
      this.logger.warn(`${failed.length} connector sync jobs failed to dispatch in batch`);
    }

    const totalDispatched = connections.length - failed.length;
    this.logger.log(`Dispatched ${totalDispatched} ConnectorSyncJob jobs, ${failed.length} failed`);
  }
}
