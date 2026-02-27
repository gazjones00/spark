import { z } from "zod";

export const HelloResponseSchema = z
  .object({
    message: z.string(),
  })
  .meta({ id: "HelloResponse" });

export type HelloResponse = z.infer<typeof HelloResponseSchema>;
