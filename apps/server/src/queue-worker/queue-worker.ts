import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Logger as PinoNestLogger } from "nestjs-pino";
import { rootLogger } from "../observability/logging.config";
import { initSentry } from "../observability/sentry";
import { QueueWorkerModule } from "./queue-worker.module";

async function bootstrap() {
  initSentry();

  const app = await NestFactory.createApplicationContext(QueueWorkerModule, {
    bufferLogs: true,
  });

  // Route all Nest logging through the shared redacting pino logger.
  app.useLogger(app.get(PinoNestLogger));

  const logger = new Logger("QueueWorker");
  logger.log("Queue worker started");

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.log("Shutting down queue worker...");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error: unknown) => {
  // Without this catch a boot failure (e.g. Redis unreachable) surfaces as
  // the runtime's raw unhandled-rejection dump, bypassing the redacting
  // `err` serializer.
  rootLogger.fatal({ err: error }, "queue worker bootstrap failed");
  process.exit(1);
});
