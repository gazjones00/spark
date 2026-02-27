import { oc } from "@orpc/contract";
import { HelloResponseSchema } from "@spark/schema";

export const healthRoute = oc
  .route({
    method: "GET",
    path: "/health",
  })
  .output(HelloResponseSchema);
