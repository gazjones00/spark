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

    const expiring = await this.db.transaction(async (tx) => {
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
        return [];
      }

      await tx
        .update(connectorConnections)
        .set({ consentWarningIssuedAt: now, updatedAt: now })
        .where(
          inArray(
            connectorConnections.id,
            due.map((connection) => connection.id),
          ),
        );

      return due;
    });

    if (expiring === null) {
      return;
    }
    if (expiring.length === 0) {
      this.logger.log("No connections approaching consent expiry");
      return;
    }
    if (expiring.length === BATCH_SIZE) {
      this.logger.warn(`Batch limit reached (${BATCH_SIZE}); remaining warnings issue tomorrow`);
    }

    // Stamp-then-emit gives at-most-once per cycle (NFR-2): a dispatch
    // failure here leaves the stamp in place rather than risking duplicate
    // notifications. The jobId keys on the grant, so a re-stamped later
    // cycle produces a distinct job.
    const dispatches = await Promise.allSettled(
      expiring
        // The predicate guarantees a non-null expiry; the filter narrows the type.
        .filter(
          (connection): connection is ExpiringConnection & { consentExpiresAt: Date } =>
            connection.consentExpiresAt !== null,
        )
        .map((connection) =>
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
              jobId: `consent-expiring:${connection.id}:${connection.consentGrantedAt?.getTime() ?? 0}`,
            },
          ),
        ),
    );

    const failed = dispatches.filter((dispatch) => dispatch.status === "rejected").length;
    this.logger.log(
      `Issued ${expiring.length - failed} consent expiry warnings, ${failed} failed to dispatch`,
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
