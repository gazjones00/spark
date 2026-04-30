import { z } from "zod";
import { ConnectorManifestSchema } from "./manifest.ts";

export const ListConnectorsResponseSchema = z
  .object({
    connectors: z.array(ConnectorManifestSchema),
  })
  .meta({ id: "ListConnectorsResponse" });

export type ListConnectorsResponse = z.infer<typeof ListConnectorsResponseSchema>;

const ConnectorCredentialsSchema = z.record(z.string().min(1), z.string().min(1));
const ConnectorConnectionOptionsSchema = z.record(z.string().min(1), z.unknown());

export const TestConnectorConnectionInputSchema = z
  .object({
    providerId: z.string().min(1),
    environment: z.string().min(1),
    credentials: ConnectorCredentialsSchema,
    connectionOptions: ConnectorConnectionOptionsSchema.optional(),
  })
  .meta({ id: "TestConnectorConnectionInput" });

export type TestConnectorConnectionInput = z.infer<typeof TestConnectorConnectionInputSchema>;

export const TestConnectorConnectionResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .meta({ id: "TestConnectorConnectionResponse" });

export type TestConnectorConnectionResponse = z.infer<typeof TestConnectorConnectionResponseSchema>;

export const CreateConnectorConnectionInputSchema = z
  .object({
    providerId: z.string().min(1),
    environment: z.string().min(1),
    credentials: ConnectorCredentialsSchema,
    connectionOptions: ConnectorConnectionOptionsSchema.optional(),
  })
  .meta({ id: "CreateConnectorConnectionInput" });

export type CreateConnectorConnectionInput = z.infer<typeof CreateConnectorConnectionInputSchema>;

export const CreateConnectorConnectionResponseSchema = z
  .object({
    connectionId: z.uuid(),
  })
  .meta({ id: "CreateConnectorConnectionResponse" });

export type CreateConnectorConnectionResponse = z.infer<
  typeof CreateConnectorConnectionResponseSchema
>;

export const SyncConnectorConnectionInputSchema = z
  .object({
    connectionId: z.uuid(),
  })
  .meta({ id: "SyncConnectorConnectionInput" });

export type SyncConnectorConnectionInput = z.infer<typeof SyncConnectorConnectionInputSchema>;

export const SyncConnectorConnectionResponseSchema = z
  .object({
    syncRunId: z.uuid(),
    status: z.enum(["success", "partial", "failed"]),
    recordsRead: z.number().int().min(0),
    recordsWritten: z.number().int().min(0),
  })
  .meta({ id: "SyncConnectorConnectionResponse" });

export type SyncConnectorConnectionResponse = z.infer<typeof SyncConnectorConnectionResponseSchema>;
