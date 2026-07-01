import { z } from "zod";

export const HealthDependencySchema = z.object({
  status: z.enum(["up", "down"]),
  message: z.string().optional(),
});

export const HealthResponseSchema = z
  .object({
    status: z.enum(["ok", "error"]),
    details: z.record(z.string(), HealthDependencySchema),
  })
  .meta({ id: "HealthResponse" });

export type HealthDependency = z.infer<typeof HealthDependencySchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
