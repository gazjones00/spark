import { oc } from "@orpc/contract";
import {
  BalanceSeriesInputSchema,
  BalanceSeriesResponseSchema,
  ClearTransactionCategoryInputSchema,
  ClearTransactionCategoryResponseSchema,
  ListTransactionsInputSchema,
  ListTransactionsResponseSchema,
  MonthlySummaryInputSchema,
  MonthlySummaryResponseSchema,
  SetTransactionCategoryInputSchema,
  SetTransactionCategoryResponseSchema,
} from "@spark/schema";

export const transactionsRouter = oc.router({
  list: oc
    .route({
      method: "GET",
      path: "/transactions",
    })
    .input(ListTransactionsInputSchema)
    .output(ListTransactionsResponseSchema),
  // Writes a per-transaction category override into the derived enrichment
  // layer — provider rows are never mutated, so the edit survives resyncs.
  setCategory: oc
    .route({
      method: "PUT",
      path: "/transactions/{transactionId}/category",
    })
    .input(SetTransactionCategoryInputSchema)
    .output(SetTransactionCategoryResponseSchema),
  // Removes the per-transaction override so the category is governed by
  // rules/defaults again ("reset to automatic").
  clearCategory: oc
    .route({
      method: "DELETE",
      path: "/transactions/{transactionId}/category",
    })
    .input(ClearTransactionCategoryInputSchema)
    .output(ClearTransactionCategoryResponseSchema),
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
