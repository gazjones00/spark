import type { FactoryProvider } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MessageQueue, QUEUE_DRIVER } from "./constants";
import type { MessageQueueDriver } from "./drivers/message-queue-driver.interface";
import { MessageQueueCoreModule, MODULE_OPTIONS_TOKEN } from "./message-queue-core.module";
import { MessageQueueService } from "./services/message-queue.service";

function fakeDriver(): MessageQueueDriver {
  return {
    register: vi.fn(),
    add: vi.fn().mockResolvedValue(undefined),
    work: vi.fn(),
  };
}

function findProvider(providers: unknown[], token: unknown): FactoryProvider {
  const provider = providers.find(
    (p) => (p as { provide?: unknown }).provide === token,
  ) as FactoryProvider;
  expect(provider).toBeDefined();
  return provider;
}

describe("MessageQueueCoreModule providers", () => {
  it("constructs queue services through the real constructor, registering exactly once", () => {
    const driver = fakeDriver();
    const dynamicModule = MessageQueueCoreModule.register({ driver });
    const provider = findProvider(dynamicModule.providers ?? [], `QUEUE_${MessageQueue.DEFAULT}`);

    const service = provider.useFactory(driver);

    expect(service).toBeInstanceOf(MessageQueueService);
    expect(driver.register).toHaveBeenCalledTimes(1);
    expect(driver.register).toHaveBeenCalledWith(MessageQueue.DEFAULT);
    expect(provider.inject).toEqual([QUEUE_DRIVER]);
  });

  it("provides one queue service per MessageQueue value and exports them", () => {
    const dynamicModule = MessageQueueCoreModule.register({ driver: fakeDriver() });

    for (const queueName of Object.values(MessageQueue)) {
      findProvider(dynamicModule.providers ?? [], `QUEUE_${queueName}`);
      expect(dynamicModule.exports).toContain(`QUEUE_${queueName}`);
    }
    expect(dynamicModule.exports).toContain(QUEUE_DRIVER);
  });

  it("registerAsync exposes the factory-produced driver under QUEUE_DRIVER", () => {
    const driver = fakeDriver();
    const dynamicModule = MessageQueueCoreModule.registerAsync({
      useFactory: () => ({ driver }),
    });

    const driverProvider = findProvider(dynamicModule.providers ?? [], QUEUE_DRIVER);
    expect(driverProvider.inject).toEqual([MODULE_OPTIONS_TOKEN]);
    // The QUEUE_DRIVER provider unwraps the module options, so the container
    // instance IS the driver — which is what makes its lifecycle hooks fire.
    expect(driverProvider.useFactory({ driver })).toBe(driver);
  });
});
