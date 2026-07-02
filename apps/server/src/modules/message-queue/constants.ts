export const PROCESSOR_METADATA = Symbol("message-queue:processor_metadata");
export const PROCESS_METADATA = Symbol("message-queue:process_metadata");
export const CRON_METADATA = Symbol("message-queue:cron_metadata");
export const QUEUE_DRIVER = Symbol("message-queue:queue_driver");

export enum MessageQueue {
  DEFAULT = "DEFAULT",
  /**
   * Terminal job failures are parked here (payload + normalised error) by
   * the BullMQ driver. No worker consumes it; inspect via Bull Board.
   */
  DEAD_LETTER = "DEAD_LETTER",
}

export enum Jobs {
  AccountSync = "AccountSync",
  /** Outbound `consent.expiring` event for the notification channel. */
  ConsentExpiring = "ConsentExpiring",
  ConsentLifecycleCheck = "ConsentLifecycleCheck",
  ConnectorPeriodicSync = "ConnectorPeriodicSync",
  ConnectorSync = "ConnectorSync",
  InitialSync = "InitialSync",
  OauthStateCleanup = "OauthStateCleanup",
  PeriodicSync = "PeriodicSync",
}
