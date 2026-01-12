import { Module } from "@nestjs/common";
import { ExampleJob } from "./example/example.job";

@Module({
  providers: [ExampleJob],
})
export class JobsModule {}
