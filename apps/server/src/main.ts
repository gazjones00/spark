import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { env } from "@spark/env/server";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
