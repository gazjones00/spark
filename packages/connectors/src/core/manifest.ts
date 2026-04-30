import { z } from "zod";
import { ConnectorCapabilitiesSchema } from "./capabilities.ts";
import { FinancialProviderTypeSchema } from "./financial.ts";

export const ConnectorAuthType = {
  BasicApiKey: "BASIC_API_KEY",
  BearerToken: "BEARER_TOKEN",
  OAuth2: "OAUTH2",
  None: "NONE",
} as const;

export const ConnectorAuthTypeSchema = z.enum([
  ConnectorAuthType.BasicApiKey,
  ConnectorAuthType.BearerToken,
  ConnectorAuthType.OAuth2,
  ConnectorAuthType.None,
]);

export const ConnectorAuthFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "password", "select"]),
  required: z.boolean(),
  secret: z.boolean(),
  description: z.string().optional(),
});

export const ConnectorAuthSchema = z.object({
  type: ConnectorAuthTypeSchema,
  fields: z.array(ConnectorAuthFieldSchema).readonly(),
});

export const ConnectorEnvironmentSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  baseUrl: z.url(),
  default: z.boolean().default(false),
});

export const ConnectorResourceSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  path: z.string().min(1),
  paginated: z.boolean(),
  syncMode: z.enum(["FULL_REFRESH", "INCREMENTAL", "SNAPSHOT"]),
});

export const ConnectorManifestSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  providerType: FinancialProviderTypeSchema,
  version: z.string().min(1),
  readOnly: z.boolean(),
  auth: ConnectorAuthSchema,
  environments: z.array(ConnectorEnvironmentSchema).min(1).readonly(),
  capabilities: ConnectorCapabilitiesSchema,
  resources: z.array(ConnectorResourceSchema).readonly(),
  knownLimitations: z.array(z.string()).readonly().default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ConnectorAuthType = z.infer<typeof ConnectorAuthTypeSchema>;
export type ConnectorAuthField = z.infer<typeof ConnectorAuthFieldSchema>;
export type ConnectorAuth = z.infer<typeof ConnectorAuthSchema>;
export type ConnectorEnvironment = z.infer<typeof ConnectorEnvironmentSchema>;
export type ConnectorResource = z.infer<typeof ConnectorResourceSchema>;
export type ConnectorManifest = z.infer<typeof ConnectorManifestSchema>;
