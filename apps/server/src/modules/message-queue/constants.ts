export const PROCESSOR_METADATA = Symbol("message-queue:processor_metadata");
export const PROCESS_METADATA = Symbol("message-queue:process_metadata");
export const CRON_METADATA = Symbol("message-queue:cron_metadata");
export const QUEUE_DRIVER = Symbol("message-queue:queue_driver");

export enum MessageQueue {
  DEFAULT = "DEFAULT",
}

export enum Jobs {
  AccountSync = "AccountSync",
  InitialSync = "InitialSync",
  PeriodicSync = "PeriodicSync",
}
