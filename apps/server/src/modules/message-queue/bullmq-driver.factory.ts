import { env } from "@spark/env/server";
import { rootLogger } from "../../observability/logging.config";
import { reportError } from "../../observability/sentry";
import { BullMQDriver } from "./drivers/bullmq.driver";

/**
 * Single source of truth for the BullMQ driver's Redis configuration.
 * Both processes (API `AppModule` and worker `QueueWorkerModule`) build
 * their driver through this factory — inside the DI container via
 * `MessageQueueModule.registerAsync` — so the connection config cannot
 * drift between them and Nest owns the instance's lifecycle.
 */
export function createBullMQDriver(): BullMQDriver {
  return new BullMQDriver({
    connection: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    },
    logger: rootLogger.child({ context: "BullMQDriver" }),
    onTerminalFailure: reportError,
  });
}
