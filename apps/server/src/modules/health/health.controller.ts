import { Controller, Get } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { contract } from "@spark/orpc/contract";
import { HealthService } from "./health.service";

/** Probed by load balancers / uptime monitors, which cannot authenticate. */
@AllowAnonymous()
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Readiness: 200 with per-dependency detail when Postgres + Redis are up,
   * 503 identifying the failed dependency otherwise. Load balancers and
   * uptime monitors should poll this.
   */
  @Implement(contract.health)
  health() {
    return implement(contract.health).handler(() => this.healthService.check());
  }

  /**
   * Liveness: no dependency I/O — only proves the process is up, so
   * orchestrators restart on process death rather than dependency outage.
   * Deliberately a plain Nest route outside the oRPC contract.
   */
  @Get("health/live")
  live(): { status: "ok" } {
    return { status: "ok" };
  }
}
