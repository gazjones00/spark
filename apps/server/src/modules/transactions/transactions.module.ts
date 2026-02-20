import { Module } from "@nestjs/common";
import { TransactionSyncService } from "./transaction-sync.service";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionSyncService],
  exports: [TransactionsService, TransactionSyncService],
})
export class TransactionsModule {}
