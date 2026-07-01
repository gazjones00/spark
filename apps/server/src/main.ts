import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { env } from "@spark/env/server";
import type { NextFunction, Request, Response } from "express";
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
  // The Bull Board dashboard (/queues) serves its own inline-scripted UI,
  // so only that path opts out of CSP; every other route keeps helmet's
  // default CSP alongside the rest of the headers.
  const helmetWithCsp = helmet();
  const helmetWithoutCsp = helmet({ contentSecurityPolicy: false });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith("/queues")
      ? helmetWithoutCsp(req, res, next)
      : helmetWithCsp(req, res, next),
  );
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
