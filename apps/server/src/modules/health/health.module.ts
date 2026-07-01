import { Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { env } from "@spark/env/server";
import { Redis } from "ioredis";
import { HEALTH_REDIS_CLIENT } from "./constants";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { DatabaseHealthIndicator } from "./indicators/database.health";
import { RedisHealthIndicator } from "./indicators/redis.health";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    {
      provide: HEALTH_REDIS_CLIENT,
      useFactory: () =>
        new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          retryStrategy: (times) => Math.min(times * 200, 1000),
        }),
    },
  ],
})
export class HealthModule implements OnModuleDestroy {
  constructor(@Inject(HEALTH_REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
