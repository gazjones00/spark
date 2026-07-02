import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { ConnectorConnectionService } from "../connectors";
import { AccountsService } from "./accounts.service";

interface SiblingRow {
  metadata: Record<string, unknown>;
  externalId: string;
}

function createService({
  account,
  siblings,
}: {
  account: Record<string, unknown> | undefined;
  siblings: SiblingRow[];
}) {
  const deleteChain = { where: vi.fn().mockResolvedValue(undefined) };
  const siblingsChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(siblings),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const db = {
    query: {
      financialAccounts: { findFirst: vi.fn(async () => account) },
      connectorConnections: {
        findFirst: vi.fn(async () => ({ id: "conn-1", metadata: { accountIds: ["a", "b"] } })),
      },
    },
    delete: vi.fn(() => deleteChain),
    select: vi.fn(() => siblingsChain),
    update: vi.fn(() => updateChain),
  };
  const connectionService = {
    deleteConnection: vi.fn(async () => undefined),
  };

  const service = new AccountsService(
    db as never,
    connectionService as unknown as ConnectorConnectionService,
  );
  return { service, db, connectionService, deleteChain, updateChain };
}

const ACCOUNT = {
  id: "account-1",
  userId: "user-1",
  connectionId: "conn-1",
  providerId: "truelayer",
  externalId: "truelayer:acc-1",
  metadata: { truelayerAccountId: "acc-1" },
};

describe("AccountsService.delete", () => {
  it("pins the allow-list to the surviving accounts when siblings remain", async () => {
    const { service, connectionService, updateChain } = createService({
      account: ACCOUNT,
      siblings: [{ metadata: { truelayerAccountId: "acc-2" }, externalId: "truelayer:acc-2" }],
    });

    await expect(service.delete("user-1", "account-1")).resolves.toEqual({ success: true });

    expect(connectionService.deleteConnection).not.toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ accountIds: ["acc-2"] }),
      }),
    );
  });

  it("disconnects the whole connection when the last account is deleted", async () => {
    const { service, connectionService, updateChain } = createService({
      account: ACCOUNT,
      siblings: [],
    });

    await expect(service.delete("user-1", "account-1")).resolves.toEqual({ success: true });

    expect(connectionService.deleteConnection).toHaveBeenCalledWith("user-1", "conn-1");
    // The connection row is deleted, so no allow-list rewrite happens.
    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it("succeeds when the connection was already removed concurrently", async () => {
    const { service, connectionService } = createService({ account: ACCOUNT, siblings: [] });
    connectionService.deleteConnection.mockRejectedValueOnce(
      new NotFoundException("Connector connection not found."),
    );

    await expect(service.delete("user-1", "account-1")).resolves.toEqual({ success: true });
  });

  it("rejects deletes of accounts the user does not own", async () => {
    const { service, db } = createService({
      account: { ...ACCOUNT, userId: "someone-else" },
      siblings: [],
    });

    await expect(service.delete("user-1", "account-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(db.delete).not.toHaveBeenCalled();
  });
});
