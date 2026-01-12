import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, ModuleRef } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import type { MessageQueueJob } from "./drivers/message-queue-driver.interface";
import { MessageQueueMetadataAccessor } from "./message-queue-metadata.accessor";
import { MessageQueueService } from "./services/message-queue.service";

interface ProcessorInstance {
  instance: Record<string, (...args: unknown[]) => Promise<void>>;
  methods: Array<{ methodName: string; jobName: string }>;
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

  onModuleInit() {
    this.explore();
  }

  explore() {
    const processors = this.discoveryService
      .getProviders()
      .filter((wrapper) => this.isProcessor(wrapper));

    const grouped = this.groupByQueueName(processors);

    for (const [queueName, processorInstances] of Object.entries(grouped)) {
      const queueService = this.moduleRef.get<MessageQueueService>(`QUEUE_${queueName}`, {
        strict: false,
      });

      queueService.work(async (job: MessageQueueJob) => {
        for (const { instance, methods } of processorInstances) {
          for (const { methodName, jobName } of methods) {
            if (jobName === job.name) {
              this.logger.log(`Processing job "${job.name}" (id: ${job.id})`);
              await instance[methodName](job.data);
            }
          }
        }
      });

      this.logger.log(`Worker registered for queue "${queueName}"`);
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
      const methods: ProcessorInstance["methods"] = [];

      this.metadataScanner.scanFromPrototype(instance, prototype, (methodName) => {
        const processMetadata = this.metadataAccessor.getProcessMetadata(prototype[methodName]);
        if (processMetadata) {
          methods.push({ methodName, jobName: processMetadata.jobName });
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
}
