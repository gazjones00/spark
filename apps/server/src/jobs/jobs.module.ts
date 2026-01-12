import { Module } from "@nestjs/common";
import { ExampleJob } from "./example/example.job";
import { InitialSyncJob } from "./initial-sync/initial-sync.job";

@Module({
  providers: [ExampleJob, InitialSyncJob],
})
export class JobsModule {}
