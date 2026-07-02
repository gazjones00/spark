import { Inject, Injectable, Logger } from "@nestjs/common";
import { inArray, lt, sql, type Database } from "@spark/db";
import { truelayerOauthStates } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../modules/database";
import { Cron, Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";

const BATCH_SIZE = 500;
/** Backstop so a pathological backlog cannot pin the worker slot forever. */
const MAX_BATCHES = 20;
/**
 * Rows must be expired by at least this long before they are swept. Reads
 * already treat `expiresAt` as an exclusion bound, so the buffer only exists
 * to keep the sweeper clear of an in-flight flow racing the boundary.
 */
const EXPIRY_BUFFER_MS = 60 * 60 * 1000;
/** Distinct from the scheduler locks (4242001 legacy, 4242002 connector). */
const SWEEPER_LOCK_KEY = 4242003;

/**
 * Deletes expired `truelayer_oauth_states` rows. The connect flow only
 * removes a state row on the happy path (saveAccounts), so an abandoned flow
 * leaves its row forever — and rows abandoned after the code exchange carry
 * encrypted LIVE access/refresh tokens. States expire 10 minutes after
 * creation and expired rows are unreadable by the flow, so anything past
 * expiry + buffer is unreachable and safe to remove.
 */
@Processor(MessageQueue.DEFAULT)
@Injectable()
export class OauthStateCleanupJob {
  private readonly logger = new Logger(OauthStateCleanupJob.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  @Cron("0 * * * *")
  @Process(Jobs.OauthStateCleanup)
  async handle(): Promise<void> {
    let totalDeleted = 0;

    // Bounded batches: each page runs in its own short transaction under an
    // advisory lock, so a large backlog never holds one long transaction and
    // concurrent instances never double-scan (deletes are idempotent anyway).
    for (let page = 0; page < MAX_BATCHES; page++) {
      const deleted = await this.db.transaction(async (tx) => {
        const lockResult = await tx.execute(
          sql`SELECT pg_try_advisory_xact_lock(${SWEEPER_LOCK_KEY}) AS locked`,
        );
        const locked = Boolean(lockResult.rows?.[0]?.locked);
        if (!locked) {
          return null;
        }

        const cutoff = new Date(Date.now() - EXPIRY_BUFFER_MS);
        const expired = await tx
          .select({ state: truelayerOauthStates.state })
          .from(truelayerOauthStates)
          .where(lt(truelayerOauthStates.expiresAt, cutoff))
          .limit(BATCH_SIZE);

        if (expired.length === 0) {
          return 0;
        }

        const rows = await tx
          .delete(truelayerOauthStates)
          .where(
            inArray(
              truelayerOauthStates.state,
              expired.map((row) => row.state),
            ),
          )
          .returning({ state: truelayerOauthStates.state });
        return rows.length;
      });

      if (deleted === null) {
        this.logger.debug("Skipping OAuth-state cleanup; sweeper lock not acquired");
        return;
      }

      totalDeleted += deleted;
      if (deleted < BATCH_SIZE) {
        break;
      }
    }

    this.logger.log(`Deleted ${totalDeleted} expired TrueLayer OAuth state rows`);
  }
}
