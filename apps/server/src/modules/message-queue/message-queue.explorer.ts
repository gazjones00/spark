import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, ModuleRef } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { env } from "@spark/env/server";
import { UnrecoverableError } from "bullmq";
import { z } from "zod";
import { type Jobs } from "./constants";
import type { MessageQueueJob } from "./drivers/message-queue-driver.interface";
import { JOB_SCHEMAS } from "./job-schemas";
import { MessageQueueMetadataAccessor } from "./message-queue-metadata.accessor";
import { MessageQueueService } from "./services/message-queue.service";

interface MethodMetadata {
  methodName: string;
  jobName: Jobs;
  cron?: {
    pattern: string;
    schedulerId: string;
  };
}

interface ProcessorInstance {
  instance: Record<string, (...args: unknown[]) => Promise<void>>;
  methods: MethodMetadata[];
}

interface QueueHandlerMap {
  handlers: Map<Jobs, (data: unknown) => Promise<void>>;
  cronJobs: { jobName: Jobs; cron: MethodMetadata["cron"] }[];
}

@Injectable()
export class MessageQueueExplorer implements OnModuleInit {
  private readonly logger = new Logger(MessageQueueExplorer.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataAccessor: MessageQueueMetadataAccessor,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  async onModuleInit() {
    await this.explore();
  }

  async explore() {
    const processors = this.discoveryService
      .getProviders()
      .filter((wrapper) => this.isProcessor(wrapper));

    const grouped = this.groupByQueueName(processors);

    for (const [queueName, processorInstances] of Object.entries(grouped)) {
      const queueService = this.moduleRef.get<MessageQueueService>(`QUEUE_${queueName}`, {
        strict: false,
      });

      const { handlers, cronJobs } = this.buildQueueHandlers(processorInstances);

      queueService.work((job: MessageQueueJob) => this.dispatch(handlers, job), {
        // Bound the pool: at most WORKER_CONCURRENCY jobs (financial syncs)
        // run in parallel per worker process, and the limiter caps queue
        // throughput to QUEUE_LIMITER_MAX jobs per window so a scheduler
        // fan-out can't burst-hammer upstream providers.
        concurrency: env.WORKER_CONCURRENCY,
        limiter: {
          max: env.QUEUE_LIMITER_MAX,
          duration: env.QUEUE_LIMITER_DURATION_MS,
        },
      });

      this.logger.log(`Worker registered for queue "${queueName}" (${handlers.size} handlers)`);

      await this.registerCronJobs(queueService, cronJobs);
    }
  }

  /**
   * Validates the payload against the job's schema before the handler runs
   * (parse-don't-validate at the queue trust boundary). Invalid payloads are
   * permanent failures: `UnrecoverableError` makes BullMQ skip the remaining
   * retry attempts, so the job fails immediately and is dead-lettered by the
   * driver instead of burning through the backoff schedule.
   */
  async dispatch(
    handlers: Map<Jobs, (data: unknown) => Promise<void>>,
    job: MessageQueueJob,
  ): Promise<void> {
    const handler = handlers.get(job.name);
    if (!handler) {
      this.logger.warn(`No handler registered for job "${job.name}"`);
      return;
    }

    const schema = JOB_SCHEMAS[job.name];
    const parsed = schema.safeParse(job.data);
    if (!parsed.success) {
      this.logger.error(
        `Rejecting job "${job.name}" (id: ${job.id}): payload does not match schema`,
      );
      throw new UnrecoverableError(
        `Invalid payload for job "${job.name}": ${z.prettifyError(parsed.error)}`,
      );
    }

    this.logger.log(`Processing job "${job.name}" (id: ${job.id})`);
    try {
      // Handler failures (unlike validation failures) are legitimately
      // retryable, so they propagate as plain errors.
      await handler(parsed.data);
    } catch (error) {
      this.logger.error(
        `Job "${job.name}" (id: ${job.id}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  private async registerCronJobs(
    queueService: MessageQueueService,
    cronJobs: QueueHandlerMap["cronJobs"],
  ): Promise<void> {
    for (const { jobName, cron } of cronJobs) {
      if (!cron) continue;
      await queueService.addCron(cron.schedulerId, cron.pattern, jobName, {});
      this.logger.log(
        `Cron job registered: "${jobName}" with pattern "${cron.pattern}" (schedulerId: ${cron.schedulerId})`,
      );
    }
  }

  private isProcessor(wrapper: InstanceWrapper): boolean {
    const target = wrapper.metatype || wrapper.instance?.constructor;
    return this.metadataAccessor.isProcessor(target);
  }

  private groupByQueueName(processors: InstanceWrapper[]): Record<string, ProcessorInstance[]> {
    const grouped: Record<string, ProcessorInstance[]> = {};

    for (const wrapper of processors) {
      const target = wrapper.metatype || wrapper.instance?.constructor;
      const metadata = this.metadataAccessor.getProcessorMetadata(target);

      if (!metadata) continue;

      const queueName = metadata.queueName;
      const instance = wrapper.instance as ProcessorInstance["instance"];
      const prototype = Object.getPrototypeOf(instance);
      const methods: MethodMetadata[] = [];

      this.metadataScanner.scanFromPrototype(instance, prototype, (methodName) => {
        const processMetadata = this.metadataAccessor.getProcessMetadata(prototype[methodName]);
        if (processMetadata) {
          const cronMetadata = this.metadataAccessor.getCronMetadata(prototype[methodName]);

          const methodMeta: MethodMetadata = {
            methodName,
            jobName: processMetadata.jobName,
          };

          if (cronMetadata) {
            methodMeta.cron = {
              pattern: cronMetadata.pattern,
              schedulerId:
                cronMetadata.schedulerId ?? this.generateSchedulerId(processMetadata.jobName),
            };
          }

          methods.push(methodMeta);
        }
      });

      if (methods.length > 0) {
        if (!grouped[queueName]) {
          grouped[queueName] = [];
        }
        grouped[queueName].push({ instance, methods });
      }
    }

    return grouped;
  }

  private buildQueueHandlers(processorInstances: ProcessorInstance[]): QueueHandlerMap {
    const handlers = new Map<Jobs, (data: unknown) => Promise<void>>();
    const cronJobs: QueueHandlerMap["cronJobs"] = [];

    for (const { instance, methods } of processorInstances) {
      for (const { methodName, jobName, cron } of methods) {
        if (handlers.has(jobName)) {
          throw new Error(`Duplicate job handler registered for "${jobName}"`);
        }

        handlers.set(jobName, (data: unknown) => instance[methodName](data));

        if (cron) {
          cronJobs.push({ jobName, cron });
        }
      }
    }

    return { handlers, cronJobs };
  }

  private generateSchedulerId(jobName: string): string {
    return jobName
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .toLowerCase();
  }
}
