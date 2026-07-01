import { Inject, Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import { type Database, sql } from "@spark/db";
import { normalizeError } from "../../../observability/redaction";
import { DATABASE_CONNECTION } from "../../database/constants";
import { HEALTH_CHECK_TIMEOUT_MS } from "../constants";
import { withTimeout } from "../with-timeout";

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  async isHealthy(key = "database"): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await withTimeout(this.db.execute(sql`SELECT 1`), HEALTH_CHECK_TIMEOUT_MS);
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: normalizeError(error).message });
    }
  }
}
