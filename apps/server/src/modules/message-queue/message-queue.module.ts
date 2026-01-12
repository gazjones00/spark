import { type DynamicModule, Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import {
  ASYNC_OPTIONS_TYPE,
  MessageQueueCoreModule,
  OPTIONS_TYPE,
} from "./message-queue-core.module";
import { MessageQueueExplorer } from "./message-queue.explorer";
import { MessageQueueMetadataAccessor } from "./message-queue-metadata.accessor";

@Global()
@Module({})
export class MessageQueueModule {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    return {
      module: MessageQueueModule,
      imports: [MessageQueueCoreModule.register(options)],
    };
  }

  static registerExplorer(): DynamicModule {
    return {
      module: MessageQueueModule,
      imports: [DiscoveryModule],
      providers: [MessageQueueExplorer, MessageQueueMetadataAccessor],
    };
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return {
      module: MessageQueueModule,
      imports: [MessageQueueCoreModule.registerAsync(options)],
    };
  }
}
