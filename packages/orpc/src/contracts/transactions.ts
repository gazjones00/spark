import { oc } from "@orpc/contract";
import { ListTransactionsInputSchema, ListTransactionsResponseSchema } from "@spark/schema";

export const transactionsRouter = oc.router({
  list: oc
    .route({
      method: "GET",
      path: "/transactions",
    })
    .input(ListTransactionsInputSchema)
    .output(ListTransactionsResponseSchema),
});
