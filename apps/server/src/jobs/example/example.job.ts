import { Injectable, Logger } from "@nestjs/common";
import { MessageQueue, Process, Processor } from "../../modules/message-queue";

export interface ExampleJobData {
  message: string;
}

@Processor(MessageQueue.default)
@Injectable()
export class ExampleJob {
  private readonly logger = new Logger(ExampleJob.name);

  @Process("ExampleJob")
  async handle(data: ExampleJobData): Promise<void> {
    this.logger.log(`Processing ExampleJob with message: ${data.message}`);
  }
}
