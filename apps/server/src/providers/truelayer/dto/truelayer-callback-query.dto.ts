import { TruelayerCallbackQuerySchema } from "@spark/schema";
import { createZodDto } from "nestjs-zod";

export class TruelayerCallbackQueryDto extends createZodDto(TruelayerCallbackQuerySchema) {}
