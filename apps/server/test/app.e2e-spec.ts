import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

describe("AppModule (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("/health/live (GET) responds without dependency I/O", () => {
    return request(app.getHttpServer()).get("/health/live").expect(200).expect({ status: "ok" });
  });

  it("/health (GET) reports per-dependency readiness", async () => {
    const response = await request(app.getHttpServer()).get("/health");
    expect([200, 503]).toContain(response.status);
    // 200 returns the HealthResponse directly; on 503 the same payload is
    // carried in the ORPCError body's `data` (see HealthService.check).
    const payload = response.status === 200 ? response.body : response.body.data;
    expect(payload.status).toBe(response.status === 200 ? "ok" : "error");
    expect(payload).toHaveProperty("details");
  });
});
