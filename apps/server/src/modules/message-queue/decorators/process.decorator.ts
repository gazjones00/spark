import { SetMetadata } from "@nestjs/common";
import { type Jobs, PROCESS_METADATA } from "../constants";

export interface MessageQueueProcessOptions {
  jobName: Jobs;
}

export function Process(jobName: Jobs): MethodDecorator {
  return SetMetadata(PROCESS_METADATA, { jobName });
}
