import { oc } from "@orpc/contract";
import {
  CategoryRuleSchema,
  CreateCategoryRuleInputSchema,
  DeleteCategoryRuleInputSchema,
  DeleteCategoryRuleResponseSchema,
  ListCategoryRulesResponseSchema,
  UpdateCategoryRuleInputSchema,
} from "@spark/schema";

/**
 * Per-user categorization rules over the derived enrichment layer. Every
 * mutation enqueues an asynchronous re-application job that re-derives
 * enrichment across the user's history — never on the request path.
 */
export const rulesRouter = oc.router({
  list: oc
    .route({
      method: "GET",
      path: "/rules",
    })
    .output(ListCategoryRulesResponseSchema),

  create: oc
    .route({
      method: "POST",
      path: "/rules",
    })
    .input(CreateCategoryRuleInputSchema)
    .output(CategoryRuleSchema),

  update: oc
    .route({
      method: "PATCH",
      path: "/rules/{ruleId}",
    })
    .input(UpdateCategoryRuleInputSchema)
    .output(CategoryRuleSchema),

  delete: oc
    .route({
      method: "DELETE",
      path: "/rules/{ruleId}",
    })
    .input(DeleteCategoryRuleInputSchema)
    .output(DeleteCategoryRuleResponseSchema),
});
