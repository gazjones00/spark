import { SetMetadata } from "@nestjs/common";
import { CRON_METADATA } from "../constants";

export interface MessageQueueCronOptions {
  pattern: string;
  schedulerId?: string;
}

export function Cron(patternOrOptions: string | MessageQueueCronOptions): MethodDecorator {
  const options: MessageQueueCronOptions =
    typeof patternOrOptions === "string" ? { pattern: patternOrOptions } : patternOrOptions;

  return SetMetadata(CRON_METADATA, options);
}
