import { Injectable, type Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PROCESSOR_METADATA, PROCESS_METADATA, CRON_METADATA } from "./constants";
import type { MessageQueueProcessorOptions } from "./decorators/processor.decorator";
import type { MessageQueueProcessOptions } from "./decorators/process.decorator";
import type { MessageQueueCronOptions } from "./decorators/cron.decorator";

@Injectable()
export class MessageQueueMetadataAccessor {
  constructor(private readonly reflector: Reflector) {}

  isProcessor(target: Type | Function): boolean {
    if (!target) return false;
    return !!this.reflector.get(PROCESSOR_METADATA, target);
  }

  isProcess(target: Type | Function): boolean {
    if (!target) return false;
    return !!this.reflector.get(PROCESS_METADATA, target);
  }

  getProcessorMetadata(target: Type | Function): MessageQueueProcessorOptions | undefined {
    return this.reflector.get(PROCESSOR_METADATA, target);
  }

  getProcessMetadata(target: Type | Function): MessageQueueProcessOptions | undefined {
    return this.reflector.get(PROCESS_METADATA, target);
  }

  isCron(target: Type | Function): boolean {
    if (!target) return false;
    return !!this.reflector.get(CRON_METADATA, target);
  }

  getCronMetadata(target: Type | Function): MessageQueueCronOptions | undefined {
    return this.reflector.get(CRON_METADATA, target);
  }
}
