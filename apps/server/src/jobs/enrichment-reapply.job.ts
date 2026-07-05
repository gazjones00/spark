import { Injectable, Logger } from "@nestjs/common";
import type { z } from "zod";
import { EnrichmentService } from "../modules/enrichment";
import { Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";
import { EnrichmentReapplyJobDataSchema } from "../modules/message-queue/job-schemas";

export type EnrichmentReapplyJobData = z.infer<typeof EnrichmentReapplyJobDataSchema>;

/**
 * Re-derives enrichment across a user's whole transaction history after a
 * rule change. Idempotent by construction: enrichment writes are
 * keyed upserts, so re-running (or overlapping with a sync) converges to
 * the state implied by the current rules — worker concurrency bounds how
 * much interleaving is possible, and the last completed run always wins.
 */
@Processor(MessageQueue.DEFAULT)
@Injectable()
export class EnrichmentReapplyJob {
  private readonly logger = new Logger(EnrichmentReapplyJob.name);

  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Process(Jobs.EnrichmentReapply)
  async handle(data: EnrichmentReapplyJobData): Promise<void> {
    const processed = await this.enrichmentService.reapplyForUser(data.userId);
    this.logger.log({
      event: "enrichment.reapply.completed",
      userId: data.userId,
      transactionsProcessed: processed,
    });
  }
}
