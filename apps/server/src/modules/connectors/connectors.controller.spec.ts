import { call } from "@orpc/server";
import type { Request } from "express";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import {
  ConnectorAuthError,
  ConnectorRateLimitError,
  ListConnectorConnectionsResponseSchema,
  ListConnectorsResponseSchema,
  SyncConnectorConnectionResponseSchema,
  Trading212Connector,
} from "@spark/connectors";
import { describe, expect, it, vi } from "vitest";
import type { ConnectorConnectionService } from "./connector-connection.service";
import type { ConnectorRegistryService } from "./connector-registry.service";
import type { ConnectorSyncService } from "./connector-sync.service";
import { ConnectorsController } from "./connectors.controller";

const SESSION = { user: { id: "user-1" } } as UserSession;
const CONNECTION_ID = "11111111-2222-4333-8444-555555555555";

function createController(
  overrides: {
    registry?: Partial<Record<keyof ConnectorRegistryService, unknown>>;
    connections?: Partial<Record<keyof ConnectorConnectionService, unknown>>;
    sync?: Partial<Record<keyof ConnectorSyncService, unknown>>;
  } = {},
) {
  const registry = {
    listManifests: vi.fn(() => [new Trading212Connector().manifest]),
    ...overrides.registry,
  };
  const connections = {
    testConnection: vi.fn().mockResolvedValue(undefined),
    createConnection: vi.fn().mockResolvedValue({ id: CONNECTION_ID }),
    listConnections: vi.fn().mockResolvedValue([]),
    deleteConnection: vi.fn().mockResolvedValue(undefined),
    ...overrides.connections,
  };
  const sync = {
    syncConnection: vi.fn().mockResolvedValue({
      syncRunId: CONNECTION_ID,
      syncResult: { status: "success" },
      recordsRead: 3,
      recordsWritten: 3,
    }),
    ...overrides.sync,
  };
  const controller = new ConnectorsController(
    registry as unknown as ConnectorRegistryService,
    connections as unknown as ConnectorConnectionService,
    sync as unknown as ConnectorSyncService,
  );
  return { controller, registry, connections, sync };
}

// The ORPCGlobalContext requires the express request (module augmentation in
// app.module); these in-process handler tests never read it.
const ORPC_CONTEXT = { context: { request: {} as Request } };

describe("ConnectorsController contract conformance", () => {
  it("list output parses against ListConnectorsResponseSchema", async () => {
    const { controller } = createController();

    const result = await call(controller.list(), undefined, ORPC_CONTEXT);

    expect(() => ListConnectorsResponseSchema.parse(result)).not.toThrow();
    expect(
      ListConnectorsResponseSchema.parse(result).connectors.map((manifest) => manifest.id),
    ).toEqual(["trading212"]);
  });

  it("listConnections serialises Date fields to ISO strings matching the contract", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const { controller } = createController({
      connections: {
        listConnections: vi.fn().mockResolvedValue([
          {
            id: CONNECTION_ID,
            providerId: "trading212",
            providerName: "Trading 212",
            environment: "live",
            capabilities: ["accounts"],
            metadata: {},
            syncStatus: "OK",
            lastSyncedAt: now,
            nextSyncAt: now,
            lastSyncErrorCode: null,
            lastSyncErrorMessage: null,
            createdAt: now,
            updatedAt: now,
          },
        ]),
      },
    });

    const result = await call(controller.listConnections(SESSION), undefined, ORPC_CONTEXT);

    const parsed = ListConnectorConnectionsResponseSchema.parse(result);
    expect(parsed.connections[0]).toMatchObject({
      lastSyncedAt: "2026-07-01T10:00:00.000Z",
      nextSyncAt: "2026-07-01T10:00:00.000Z",
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-01T10:00:00.000Z",
    });
  });

  it("listConnections keeps null lastSyncedAt (never-synced connection)", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const { controller } = createController({
      connections: {
        listConnections: vi.fn().mockResolvedValue([
          {
            id: CONNECTION_ID,
            providerId: "trading212",
            providerName: "Trading 212",
            environment: "live",
            capabilities: [],
            metadata: {},
            syncStatus: "OK",
            lastSyncedAt: null,
            nextSyncAt: now,
            lastSyncErrorCode: null,
            lastSyncErrorMessage: null,
            createdAt: now,
            updatedAt: now,
          },
        ]),
      },
    });

    const result = await call(controller.listConnections(SESSION), undefined, ORPC_CONTEXT);

    expect(ListConnectorConnectionsResponseSchema.parse(result).connections[0]?.lastSyncedAt).toBe(
      null,
    );
  });

  it("syncConnection success output parses against the contract and scopes to the session user", async () => {
    const { controller, sync } = createController();

    const result = await call(
      controller.syncConnection(SESSION),
      { connectionId: CONNECTION_ID },
      ORPC_CONTEXT,
    );

    expect(() => SyncConnectorConnectionResponseSchema.parse(result)).not.toThrow();
    expect(sync.syncConnection).toHaveBeenCalledWith({
      connectionId: CONNECTION_ID,
      userId: "user-1",
    });
  });

  it("maps ConnectorAuthError to the typed NEEDS_REAUTH channel", async () => {
    const { controller } = createController({
      sync: {
        syncConnection: vi.fn().mockRejectedValue(new ConnectorAuthError("revoked")),
      },
    });

    await expect(
      call(controller.syncConnection(SESSION), { connectionId: CONNECTION_ID }, ORPC_CONTEXT),
    ).rejects.toMatchObject({
      code: "NEEDS_REAUTH",
      status: 403,
      data: { connectionId: CONNECTION_ID },
    });
  });

  it("maps ConnectorRateLimitError to the typed RATE_LIMITED channel", async () => {
    const { controller } = createController({
      sync: {
        syncConnection: vi
          .fn()
          .mockRejectedValue(new ConnectorRateLimitError("slow down", { retryAfterMs: 30_000 })),
      },
    });

    await expect(
      call(controller.syncConnection(SESSION), { connectionId: CONNECTION_ID }, ORPC_CONTEXT),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("rejects schema-invalid input before reaching the service", async () => {
    const { controller, sync } = createController();

    await expect(
      call(controller.syncConnection(SESSION), { connectionId: "not-a-uuid" }, ORPC_CONTEXT),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(sync.syncConnection).not.toHaveBeenCalled();
  });
});
