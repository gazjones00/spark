import { oc } from "@orpc/contract";
import {
  DeleteAccountInputSchema,
  DeleteAccountResponseSchema,
  GetAccountsResponseSchema,
  UpdateAccountInputSchema,
  UpdateAccountResponseSchema,
} from "@spark/schema";

export const accountsRouter = oc.router({
  list: oc
    .route({
      method: "GET",
      path: "/accounts",
    })
    .output(GetAccountsResponseSchema),

  update: oc
    .route({
      method: "PATCH",
      path: "/accounts/{id}",
    })
    .input(UpdateAccountInputSchema)
    .output(UpdateAccountResponseSchema),

  delete: oc
    .route({
      method: "DELETE",
      path: "/accounts/{id}",
    })
    .input(DeleteAccountInputSchema)
    .output(DeleteAccountResponseSchema),
});
