import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { CategoryRulesService } from "./category-rules.service";
import { EnrichmentController } from "./enrichment.controller";
import { EnrichmentService } from "./enrichment.service";
import { MerchantsService } from "./merchants.service";

@Module({
  controllers: [EnrichmentController],
  providers: [CategoriesService, CategoryRulesService, EnrichmentService, MerchantsService],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
