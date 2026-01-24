import { oc } from "@orpc/contract";
import { z } from "zod";

export const HelloResponseSchema = z.object({
  message: z.string(),
});

export const healthRoute = oc
  .route({
    method: "GET",
    path: "/health",
  })
  .output(HelloResponseSchema);
