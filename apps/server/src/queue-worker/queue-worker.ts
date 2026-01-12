import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { QueueWorkerModule } from "./queue-worker.module";

async function bootstrap() {
  const logger = new Logger("QueueWorker");

  const app = await NestFactory.createApplicationContext(QueueWorkerModule, {
    bufferLogs: true,
  });

  app.useLogger(logger);

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

bootstrap();
