import { describe, expect, it, vi } from "vitest";
import type { Database } from "@spark/db";
import type { CryptoService } from "../../modules/crypto";
import type { TruelayerClient } from "./truelayer.client";
import { TruelayerConnectionService } from "./truelayer.connection.service";

interface ConnectionRow {
  id: string;
  userId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenKeyId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function setup(connection: ConnectionRow) {
  const row = { ...connection };

  // Identity crypto so encrypted strings equal their plaintext in assertions.
  const cryptoService = {
    getCurrentKeyId: () => "key-1",
    encryptToString: vi.fn(async (value: string) => value),
    decryptFromString: vi.fn(async (value: string) => value),
  } satisfies Partial<CryptoService> as unknown as CryptoService;

  const setSpy = vi.fn((values: Partial<ConnectionRow>) => {
    Object.assign(row, values);
    return {
      where: () => ({
        returning: async () => [{ id: row.id }],
      }),
    };
  });

  const db = {
    query: {
      truelayerConnections: {
        findFirst: async () => ({ ...row }),
      },
    },
    update: () => ({ set: setSpy }),
  } as unknown as Database;

  const refreshToken = vi.fn();
  const truelayerClient = { refreshToken } as unknown as TruelayerClient;

  const service = new TruelayerConnectionService(truelayerClient, cryptoService, db);

  return { service, refreshToken, row, setSpy };
}

const past = new Date(Date.now() - 60_000);
const future = new Date(Date.now() + 3_600_000);

function baseConnection(): ConnectionRow {
  return {
    id: "conn-1",
    userId: "user-1",
    encryptedAccessToken: "old-access",
    encryptedRefreshToken: "refresh-1",
    tokenKeyId: "key-1",
    expiresAt: past,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("TruelayerConnectionService.getAccessToken", () => {
  it("coalesces concurrent refreshes into a single TrueLayer call", async () => {
    const { service, refreshToken } = setup(baseConnection());
    refreshToken.mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "refresh-2",
      expiresAt: future,
    });

    const [a, b] = await Promise.all([
      service.getAccessToken("conn-1"),
      service.getAccessToken("conn-1"),
    ]);

    expect(a).toBe("new-access");
    expect(b).toBe("new-access");
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing refresh token when the response omits one", async () => {
    const { service, refreshToken, row } = setup(baseConnection());
    refreshToken.mockResolvedValue({
      accessToken: "new-access",
      refreshToken: null,
      expiresAt: future,
    });

    await service.getAccessToken("conn-1");

    expect(row.encryptedRefreshToken).toBe("refresh-1");
  });

  it("stores a rotated refresh token when the response provides one", async () => {
    const { service, refreshToken, row } = setup(baseConnection());
    refreshToken.mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "refresh-2",
      expiresAt: future,
    });

    await service.getAccessToken("conn-1");

    expect(row.encryptedRefreshToken).toBe("refresh-2");
  });

  it("returns the stored token without refreshing when it is still valid", async () => {
    const { service, refreshToken } = setup({ ...baseConnection(), expiresAt: future });

    const token = await service.getAccessToken("conn-1");

    expect(token).toBe("old-access");
    expect(refreshToken).not.toHaveBeenCalled();
  });
});
