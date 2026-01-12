import { Injectable, type Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PROCESSOR_METADATA, PROCESS_METADATA } from "./constants";
import type { MessageQueueProcessorOptions } from "./decorators/processor.decorator";
import type { MessageQueueProcessOptions } from "./decorators/process.decorator";

@Injectable()
export class MessageQueueMetadataAccessor {
  constructor(private readonly reflector: Reflector) {}

  // biome-ignore lint/complexity/noBannedTypes: NestJS reflection requires Function type
  isProcessor(target: Type | Function): boolean {
    if (!target) return false;
    return !!this.reflector.get(PROCESSOR_METADATA, target);
  }

  // biome-ignore lint/complexity/noBannedTypes: NestJS reflection requires Function type
  isProcess(target: Type | Function): boolean {
    if (!target) return false;
    return !!this.reflector.get(PROCESS_METADATA, target);
  }

  // biome-ignore lint/complexity/noBannedTypes: NestJS reflection requires Function type
  getProcessorMetadata(target: Type | Function): MessageQueueProcessorOptions | undefined {
    return this.reflector.get(PROCESSOR_METADATA, target);
  }

  // biome-ignore lint/complexity/noBannedTypes: NestJS reflection requires Function type
  getProcessMetadata(target: Type | Function): MessageQueueProcessOptions | undefined {
    return this.reflector.get(PROCESS_METADATA, target);
  }
}
