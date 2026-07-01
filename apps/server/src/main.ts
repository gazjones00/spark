import { NestFactory } from "@nestjs/core";
import { env } from "@spark/env/server";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { initSentry } from "./observability/sentry";

async function bootstrap() {
  initSentry();

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
