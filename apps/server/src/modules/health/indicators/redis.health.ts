import { Inject, Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import type { Redis } from "ioredis";
import { normalizeError } from "../../../observability/redaction";
import { HEALTH_CHECK_TIMEOUT_MS, HEALTH_REDIS_CLIENT } from "../constants";
import { withTimeout } from "../with-timeout";

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(HEALTH_REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async isHealthy(key = "redis"): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const pong = await withTimeout(this.redis.ping(), HEALTH_CHECK_TIMEOUT_MS);
      if (pong !== "PONG") {
        throw new Error(`Unexpected PING response: ${String(pong)}`);
      }
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: normalizeError(error).message });
    }
  }
}
