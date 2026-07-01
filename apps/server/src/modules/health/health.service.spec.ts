import { Test } from "@nestjs/testing";
import { TerminusModule } from "@nestjs/terminus";
import { ORPCError } from "@orpc/nest";
import { beforeEach, describe, expect, it } from "vitest";
import { HealthService } from "./health.service";
import { DatabaseHealthIndicator } from "./indicators/database.health";
import { RedisHealthIndicator } from "./indicators/redis.health";

function fakeIndicator(key: string, up: boolean, message?: string) {
  return {
    isHealthy: async () => ({
      [key]: up ? { status: "up" } : { status: "down", ...(message ? { message } : {}) },
    }),
  };
}

async function createService(databaseUp: boolean, redisUp: boolean) {
  const moduleRef = await Test.createTestingModule({
    imports: [TerminusModule],
    providers: [
      HealthService,
      { provide: DatabaseHealthIndicator, useValue: fakeIndicator("database", databaseUp) },
      {
        provide: RedisHealthIndicator,
        useValue: fakeIndicator("redis", redisUp, redisUp ? undefined : "connection refused"),
      },
    ],
  }).compile();
  return moduleRef.get(HealthService);
}

describe("HealthService", () => {
  describe("when all dependencies are up (AC-4)", () => {
    let service: HealthService;
    beforeEach(async () => {
      service = await createService(true, true);
    });

    it("returns ok with per-dependency up details", async () => {
      await expect(service.check()).resolves.toEqual({
        status: "ok",
        details: {
          database: { status: "up" },
          redis: { status: "up" },
        },
      });
    });
  });

  describe("when redis is down (AC-5)", () => {
    let service: HealthService;
    beforeEach(async () => {
      service = await createService(true, false);
    });

    it("throws a 503 ORPCError identifying the failed dependency", async () => {
      const error = await service.check().then(
        () => {
          throw new Error("expected check() to throw");
        },
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(ORPCError);
      const orpcError = error as ORPCError<string, { status: string; details: unknown }>;
      expect(orpcError.status).toBe(503);
      expect(orpcError.data.status).toBe("error");
      expect(orpcError.data.details).toMatchObject({
        redis: { status: "down", message: "connection refused" },
      });
    });
  });
});
