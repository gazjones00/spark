import {
  ConfigurableModuleBuilder,
  type DynamicModule,
  Module,
  type Provider,
} from "@nestjs/common";
import { MessageQueue, QUEUE_DRIVER } from "./constants";
import type { MessageQueueDriver } from "./drivers/message-queue-driver.interface";
import { MessageQueueService } from "./services/message-queue.service";

export interface MessageQueueModuleOptions {
  driver: MessageQueueDriver;
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE, ASYNC_OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<MessageQueueModuleOptions>().setClassMethodName("register").build();

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

const queueProviders = Object.values(MessageQueue).map((queueName) =>
  createQueueServiceProvider(queueName),
);

const driverProvider: Provider = {
  provide: QUEUE_DRIVER,
  useFactory: (options: MessageQueueModuleOptions) => options.driver,
  inject: [MODULE_OPTIONS_TOKEN],
};

@Module({})
export class MessageQueueCoreModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const baseModule = ConfigurableModuleClass.register(options);

    return {
      ...baseModule,
      global: true,
      providers: [...(baseModule.providers || []), driverProvider, ...queueProviders],
      exports: [QUEUE_DRIVER, ...queueProviders.map((p) => (p as { provide: string }).provide)],
    };
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    const baseModule = ConfigurableModuleClass.registerAsync(options);

    return {
      ...baseModule,
      global: true,
      providers: [...(baseModule.providers || []), driverProvider, ...queueProviders],
      exports: [QUEUE_DRIVER, ...queueProviders.map((p) => (p as { provide: string }).provide)],
    };
  }
}
