import { oc } from "@orpc/contract";
import { HealthResponseSchema } from "@spark/schema";

export const healthRoute = oc
  .route({
    method: "GET",
    path: "/health",
  })
  .output(HealthResponseSchema);
