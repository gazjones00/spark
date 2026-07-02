import { oc } from "@orpc/contract";
import {
  BalanceSeriesInputSchema,
  BalanceSeriesResponseSchema,
  ListTransactionsInputSchema,
  ListTransactionsResponseSchema,
  MonthlySummaryInputSchema,
  MonthlySummaryResponseSchema,
} from "@spark/schema";

export const transactionsRouter = oc.router({
  list: oc
    .route({
      method: "GET",
      path: "/transactions",
    })
    .input(ListTransactionsInputSchema)
    .output(ListTransactionsResponseSchema),
  // Aggregates read the daily rollup tables, never the raw transaction rows,
  // so responses stay bounded and correct over full history.
  monthlySummary: oc
    .route({
      method: "GET",
      path: "/transactions/aggregates/monthly",
    })
    .input(MonthlySummaryInputSchema)
    .output(MonthlySummaryResponseSchema),
  balanceSeries: oc
    .route({
      method: "GET",
      path: "/transactions/aggregates/balance-series",
    })
    .input(BalanceSeriesInputSchema)
    .output(BalanceSeriesResponseSchema),
});
