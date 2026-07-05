import { oc } from "@orpc/contract";
import {
  CreateUserCategoryInputSchema,
  DeleteUserCategoryInputSchema,
  DeleteUserCategoryResponseSchema,
  ListCategoriesResponseSchema,
  UpdateUserCategoryInputSchema,
  UserCategorySchema,
} from "@spark/schema";

/**
 * Spending categories: the built-in taxonomy plus the user's own custom
 * categories, managed here. `list` returns both merged into one display
 * list so every category picker renders from a single source.
 */
export const categoriesRouter = oc.router({
  list: oc
    .route({
      method: "GET",
      path: "/categories",
    })
    .output(ListCategoriesResponseSchema),

  create: oc
    .route({
      method: "POST",
      path: "/categories",
    })
    .input(CreateUserCategoryInputSchema)
    .output(UserCategorySchema),

  update: oc
    .route({
      method: "PATCH",
      path: "/categories/{categoryId}",
    })
    .input(UpdateUserCategoryInputSchema)
    .output(UserCategorySchema),

  delete: oc
    .route({
      method: "DELETE",
      path: "/categories/{categoryId}",
    })
    .input(DeleteUserCategoryInputSchema)
    .output(DeleteUserCategoryResponseSchema),
});
