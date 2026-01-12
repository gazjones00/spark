import { SetMetadata } from "@nestjs/common";
import { PROCESS_METADATA } from "../constants";

export interface MessageQueueProcessOptions {
  jobName: string;
}

export function Process(jobName: string): MethodDecorator {
  return SetMetadata(PROCESS_METADATA, { jobName });
}
