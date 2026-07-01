import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { type HealthCheckResult, HealthCheckService } from "@nestjs/terminus";
import { ORPCError } from "@orpc/nest";
import type { HealthResponse } from "@spark/schema";
import { DatabaseHealthIndicator } from "./indicators/database.health";
import { RedisHealthIndicator } from "./indicators/redis.health";

function toDetails(details: HealthCheckResult["details"] | undefined): HealthResponse["details"] {
  return Object.fromEntries(
    Object.entries(details ?? {}).map(([name, detail]) => {
      const message = (detail as Record<string, unknown>).message;
      return [
        name,
        {
          status: detail.status === "up" ? ("up" as const) : ("down" as const),
          ...(typeof message === "string" ? { message } : {}),
        },
      ];
    }),
  );
}

@Injectable()
export class HealthService {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly databaseIndicator: DatabaseHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  /**
   * Readiness probe: verifies Postgres and Redis are reachable.
   * Throws an ORPCError with HTTP 503 (body identifies the failed
   * dependency) when any of them is down.
   */
  async check(): Promise<HealthResponse> {
    let result: HealthCheckResult;
    try {
      result = await this.healthCheckService.check([
        () => this.databaseIndicator.isHealthy(),
        () => this.redisIndicator.isHealthy(),
      ]);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        const response = error.getResponse() as Partial<HealthCheckResult>;
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          status: 503,
          message: "One or more dependencies are unavailable",
          data: { status: "error", details: toDetails(response.details) } satisfies HealthResponse,
        });
      }
      throw error;
    }
    return { status: "ok", details: toDetails(result.details) };
  }
}
