import {
  type DynamicModule,
  Global,
  type InjectionToken,
  Module,
  type OptionalFactoryDependency,
  type Provider,
} from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { MessageQueue, QUEUE_DRIVER } from "./constants";
import type { MessageQueueDriver } from "./drivers/message-queue-driver.interface";
import { MessageQueueExplorer } from "./message-queue.explorer";
import { MessageQueueMetadataAccessor } from "./message-queue-metadata.accessor";
import { MessageQueueService } from "./services/message-queue.service";

export interface MessageQueueModuleOptions {
  driver: MessageQueueDriver;
}

export interface MessageQueueModuleAsyncOptions {
  useFactory: (...args: unknown[]) => MessageQueueDriver | Promise<MessageQueueDriver>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

function createQueueServiceProvider(queueName: MessageQueue): Provider {
  return {
    provide: `QUEUE_${queueName}`,
    useFactory: (driver: MessageQueueDriver) => {
      const service = Object.create(MessageQueueService.prototype);
      service.driver = driver;
      service.queueName = queueName;
      driver.register?.(queueName);
      return service;
    },
    inject: [QUEUE_DRIVER],
  };
}

@Global()
@Module({})
export class MessageQueueModule {
  /**
   * Register the message queue module for the API server (add jobs only)
   */
  static register(options: MessageQueueModuleOptions): DynamicModule {
    const queueProviders = Object.values(MessageQueue).map((queueName) =>
      createQueueServiceProvider(queueName),
    );

    return {
      module: MessageQueueModule,
      providers: [{ provide: QUEUE_DRIVER, useValue: options.driver }, ...queueProviders],
      exports: [QUEUE_DRIVER, ...queueProviders.map((p) => (p as { provide: string }).provide)],
    };
  }

  /**
   * Register the message queue module for the API server with async options
   */
  static registerAsync(options: MessageQueueModuleAsyncOptions): DynamicModule {
    const queueProviders = Object.values(MessageQueue).map((queueName) =>
      createQueueServiceProvider(queueName),
    );

    return {
      module: MessageQueueModule,
      providers: [
        {
          provide: QUEUE_DRIVER,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        ...queueProviders,
      ],
      exports: [QUEUE_DRIVER, ...queueProviders.map((p) => (p as { provide: string }).provide)],
    };
  }

  /**
   * Register the message queue module for the worker (process jobs)
   */
  static registerWorker(options: MessageQueueModuleOptions): DynamicModule {
    const queueProviders = Object.values(MessageQueue).map((queueName) =>
      createQueueServiceProvider(queueName),
    );

    return {
      module: MessageQueueModule,
      imports: [DiscoveryModule],
      providers: [
        { provide: QUEUE_DRIVER, useValue: options.driver },
        MessageQueueExplorer,
        MessageQueueMetadataAccessor,
        ...queueProviders,
      ],
      exports: [QUEUE_DRIVER, ...queueProviders.map((p) => (p as { provide: string }).provide)],
    };
  }

  /**
   * Register the message queue module for the worker with async options
   */
  static registerWorkerAsync(options: MessageQueueModuleAsyncOptions): DynamicModule {
    const queueProviders = Object.values(MessageQueue).map((queueName) =>
      createQueueServiceProvider(queueName),
    );

    return {
      module: MessageQueueModule,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: QUEUE_DRIVER,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        MessageQueueExplorer,
        MessageQueueMetadataAccessor,
        ...queueProviders,
      ],
      exports: [QUEUE_DRIVER, ...queueProviders.map((p) => (p as { provide: string }).provide)],
    };
  }
}
