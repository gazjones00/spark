import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, ModuleRef } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { type Jobs } from "./constants";
import type { MessageQueueJob } from "./drivers/message-queue-driver.interface";
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

      queueService.work(async (job: MessageQueueJob) => {
        const handler = handlers.get(job.name);
        if (!handler) {
          this.logger.warn(`No handler registered for job "${job.name}"`);
          return;
        }

        this.logger.log(`Processing job "${job.name}" (id: ${job.id})`);
        try {
          await handler(job.data);
        } catch (error) {
          this.logger.error(
            `Job "${job.name}" (id: ${job.id}) failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          throw error;
        }
      });

      this.logger.log(`Worker registered for queue "${queueName}" (${handlers.size} handlers)`);

      await this.registerCronJobs(queueService, cronJobs);
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
