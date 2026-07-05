import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { contract } from "@spark/orpc/contract";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { CategoriesService } from "./categories.service";
import { CategoryRulesService } from "./category-rules.service";
import { EnrichmentService } from "./enrichment.service";

@Controller()
export class EnrichmentController {
  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly rulesService: CategoryRulesService,
    private readonly categoriesService: CategoriesService,
  ) {}

  @Implement(contract.transactions.setCategory)
  setCategory(@Session() session: UserSession) {
    return implement(contract.transactions.setCategory).handler(({ input }) => {
      return this.enrichmentService.setCategory(session.user.id, input);
    });
  }

  @Implement(contract.transactions.clearCategory)
  clearCategory(@Session() session: UserSession) {
    return implement(contract.transactions.clearCategory).handler(({ input }) => {
      return this.enrichmentService.clearCategory(session.user.id, input);
    });
  }

  @Implement(contract.rules.list)
  listRules(@Session() session: UserSession) {
    return implement(contract.rules.list).handler(() => {
      return this.rulesService.list(session.user.id);
    });
  }

  @Implement(contract.rules.create)
  createRule(@Session() session: UserSession) {
    return implement(contract.rules.create).handler(({ input }) => {
      return this.rulesService.create(session.user.id, input);
    });
  }

  @Implement(contract.rules.update)
  updateRule(@Session() session: UserSession) {
    return implement(contract.rules.update).handler(({ input }) => {
      return this.rulesService.update(session.user.id, input);
    });
  }

  @Implement(contract.rules.delete)
  deleteRule(@Session() session: UserSession) {
    return implement(contract.rules.delete).handler(({ input }) => {
      return this.rulesService.delete(session.user.id, input);
    });
  }

  @Implement(contract.categories.list)
  listCategories(@Session() session: UserSession) {
    return implement(contract.categories.list).handler(() => {
      return this.categoriesService.list(session.user.id);
    });
  }

  @Implement(contract.categories.create)
  createCategory(@Session() session: UserSession) {
    return implement(contract.categories.create).handler(({ input }) => {
      return this.categoriesService.create(session.user.id, input);
    });
  }

  @Implement(contract.categories.update)
  updateCategory(@Session() session: UserSession) {
    return implement(contract.categories.update).handler(({ input }) => {
      return this.categoriesService.update(session.user.id, input);
    });
  }

  @Implement(contract.categories.delete)
  deleteCategory(@Session() session: UserSession) {
    return implement(contract.categories.delete).handler(({ input }) => {
      return this.categoriesService.delete(session.user.id, input);
    });
  }
}
