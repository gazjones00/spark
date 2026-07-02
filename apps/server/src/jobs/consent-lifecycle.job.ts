import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, inArray, isNotNull, isNull, lt, lte, or, sql, type Database } from "@spark/db";
import { connectorConnections } from "@spark/db/schema";
import type { ConsentExpiringEvent } from "@spark/schema";
import { DATABASE_CONNECTION } from "../modules/database";
import { CONSENT_WARNING_WINDOW_DAYS } from "../modules/connectors";
import { Cron, Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";
import type { MessageQueueService } from "../modules/message-queue";

const BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Distinct from 4242001/4242002 (schedulers) and 4242003 (state sweeper). */
const CONSENT_LOCK_KEY = 4242004;

interface ExpiringConnection {
  id: string;
  userId: string;
  providerId: string;
  providerName: string;
  consentExpiresAt: Date | null;
  consentGrantedAt: Date | null;
}

interface ConsentLifecycleSummary {
  selected: number;
  issued: number;
  failed: number;
  batchLimitReached: boolean;
}

/**
 * Flags connections whose estimated consent expiry falls within the warning
 * window: stamps `consentWarningIssuedAt` and emits one `consent.expiring`
 * event per consent cycle. Derivation is from local columns only — no
 * provider calls — and flagged connections keep syncing (`syncStatus` is
 * untouched); the terminal path remains a real auth failure (NEEDS_REAUTH).
 */
@Processor(MessageQueue.DEFAULT)
@Injectable()
export class ConsentLifecycleJob {
  private readonly logger = new Logger(ConsentLifecycleJob.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(`QUEUE_${MessageQueue.DEFAULT}`) private readonly queue: MessageQueueService,
  ) {}

  @Cron("0 6 * * *")
  @Process(Jobs.ConsentLifecycleCheck)
  async handle(): Promise<void> {
    this.logger.log("Starting consent lifecycle check");

    const summary = await this.db.transaction<ConsentLifecycleSummary | null>(async (tx) => {
      const lockResult = await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(${CONSENT_LOCK_KEY}) AS locked`,
      );
      const locked = Boolean(lockResult.rows?.[0]?.locked);
      if (!locked) {
        this.logger.debug("Skipping consent lifecycle check; lock not acquired");
        return null;
      }

      const now = new Date();
      const windowEnd = new Date(now.getTime() + CONSENT_WARNING_WINDOW_DAYS * DAY_MS);

      const due: ExpiringConnection[] = await tx
        .select({
          id: connectorConnections.id,
          userId: connectorConnections.userId,
          providerId: connectorConnections.providerId,
          providerName: connectorConnections.providerName,
          consentExpiresAt: connectorConnections.consentExpiresAt,
          consentGrantedAt: connectorConnections.consentGrantedAt,
        })
        .from(connectorConnections)
        .where(
          and(
            isNotNull(connectorConnections.consentExpiresAt),
            lte(connectorConnections.consentExpiresAt, windowEnd),
            // Idempotent across cycles: a stamp is only "issued" if it is
            // newer than the current grant; a stamp from a previous consent
            // cycle (older than consentGrantedAt) re-selects the row.
            or(
              isNull(connectorConnections.consentWarningIssuedAt),
              lt(
                connectorConnections.consentWarningIssuedAt,
                connectorConnections.consentGrantedAt,
              ),
            ),
          ),
        )
        .orderBy(connectorConnections.consentExpiresAt, connectorConnections.id)
        .limit(BATCH_SIZE);

      if (due.length === 0) {
        return { selected: 0, issued: 0, failed: 0, batchLimitReached: false };
      }

      const dispatchTargets = due.filter(
        (connection): connection is ExpiringConnection & { consentExpiresAt: Date } =>
          connection.consentExpiresAt !== null,
      );
      // Keep dispatch under the advisory-lock transaction so another runner
      // cannot select the same unstamped rows before successful sends are stamped.
      const dispatches = await Promise.allSettled(
        dispatchTargets.map((connection) =>
          this.queue.add<ConsentExpiringEvent>(
            Jobs.ConsentExpiring,
            {
              userId: connection.userId,
              connectionId: connection.id,
              providerId: connection.providerId,
              providerName: connection.providerName,
              consentExpiresAt: connection.consentExpiresAt.toISOString(),
            },
            {
              jobId: `consent-expiring:${connection.id}:${
                connection.consentGrantedAt?.getTime() ?? 0
              }`,
            },
          ),
        ),
      );

      const succeededIds = dispatchTargets
        .filter((_, index) => dispatches[index]?.status === "fulfilled")
        .map((connection) => connection.id);

      if (succeededIds.length > 0) {
        await tx
          .update(connectorConnections)
          .set({ consentWarningIssuedAt: now, updatedAt: now })
          .where(inArray(connectorConnections.id, succeededIds));
      }

      return {
        selected: due.length,
        issued: succeededIds.length,
        failed: dispatchTargets.length - succeededIds.length,
        batchLimitReached: due.length === BATCH_SIZE,
      };
    });

    if (summary === null) {
      return;
    }
    if (summary.selected === 0) {
      this.logger.log("No connections approaching consent expiry");
      return;
    }
    if (summary.batchLimitReached) {
      this.logger.warn(`Batch limit reached (${BATCH_SIZE}); remaining warnings issue tomorrow`);
    }

    this.logger.log(
      `Issued ${summary.issued} consent expiry warnings, ${summary.failed} failed to dispatch`,
    );
  }

  /**
   * Logger-only consumer: real delivery channels (email/push) replace this
   * without touching the producer. Ids and timestamps only — no tokens, no
   * account detail.
   */
  @Process(Jobs.ConsentExpiring)
  async handleConsentExpiring(event: ConsentExpiringEvent): Promise<void> {
    this.logger.log(
      `Consent expiring for connection ${event.connectionId} (provider ${event.providerId}) at ${event.consentExpiresAt}`,
    );
  }
}
