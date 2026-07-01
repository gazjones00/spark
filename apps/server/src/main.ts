import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { env } from "@spark/env/server";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./observability/all-exceptions.filter";
import { initSentry } from "./observability/sentry";

async function bootstrap() {
  initSentry();

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // CSP is disabled because the Bull Board dashboard (/queues) serves its
  // own inline-scripted UI; every other helmet header applies.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
