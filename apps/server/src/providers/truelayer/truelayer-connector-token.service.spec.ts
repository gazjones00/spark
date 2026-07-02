import { ConnectorAuthError, ConnectorError, type ConnectorSyncContext } from "@spark/connectors";
import { TrueLayerAuthError, type TokenResponse } from "@spark/truelayer/server";
import { describe, expect, it, vi } from "vitest";
import type { CryptoService } from "../../modules/crypto";
import type { TruelayerClient } from "./truelayer.client";
import {
  TruelayerConnectorTokenService,
  type TrueLayerCredentialRecord,
} from "./truelayer-connector-token.service";

const FUTURE = "2027-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

function tokenResponse(overrides: Partial<TokenResponse> = {}): TokenResponse {
  return {
    accessToken: "fresh-access",
    expiresIn: 3600,
    tokenType: "Bearer",
    refreshToken: "rotated-refresh",
    expiresAt: new Date(FUTURE),
    ...overrides,
  };
}

function createService({
  storedRecord,
  refresh,
}: {
  /** Credential record the transaction re-reads from the connection row. */
  storedRecord?: TrueLayerCredentialRecord;
  refresh?: TokenResponse | Error;
} = {}) {
  const client = {
    refreshToken: vi.fn(async () => {
      if (refresh instanceof Error) throw refresh;
      return refresh ?? tokenResponse();
    }),
  };
  const cryptoService = {
    getCurrentKeyId: vi.fn(() => "key-1"),
    encryptToString: vi.fn(async (_plaintext: string, _keyId: string) => "encrypted-record"),
    decryptFromString: vi.fn(async () =>
      JSON.stringify(
        storedRecord ?? {
          accessToken: "stale-access",
          refreshToken: "stored-refresh",
          expiresAt: PAST,
        },
      ),
    ),
  };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi
      .fn()
      .mockResolvedValue([{ encryptedCredentials: "encrypted", credentialKeyId: "key-1" }]),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "conn-1" }]),
  };
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
  };
  const db = {
    transaction: vi.fn(async (cb: (txArg: unknown) => unknown) => cb(tx)),
  };

  const service = new TruelayerConnectorTokenService(
    client as unknown as TruelayerClient,
    cryptoService as unknown as CryptoService,
    db as never,
  );
  return { service, client, cryptoService, db, tx, updateChain };
}

function createContext(
  credentials: Record<string, string> = {
    accessToken: "stale-access",
    refreshToken: "stored-refresh",
    expiresAt: PAST,
  },
): ConnectorSyncContext {
  return {
    connectionId: "conn-1",
    userId: "user-1",
    environment: "sandbox",
    credentials,
  };
}

describe("TruelayerConnectorTokenService", () => {
  it("returns the stored token without refreshing when it is still valid", async () => {
    const { service, client, db } = createService();

    const token = await service.getAccessToken(
      createContext({ accessToken: "live-access", expiresAt: FUTURE }),
    );

    expect(token).toBe("live-access");
    expect(client.refreshToken).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("fails terminally when the token is expired and no refresh token exists", async () => {
    const { service, client } = createService();

    await expect(
      service.getAccessToken(createContext({ accessToken: "stale", expiresAt: PAST })),
    ).rejects.toBeInstanceOf(ConnectorAuthError);
    expect(client.refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes under the per-connection lock and persists the rotated record", async () => {
    const { service, client, cryptoService, tx, updateChain } = createService();

    const token = await service.getAccessToken(createContext());

    expect(token).toBe("fresh-access");
    // The lock statement runs before the re-read inside the transaction.
    const lockOrder = tx.execute.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const rereadOrder = tx.select.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY;
    expect(lockOrder).toBeLessThan(rereadOrder);
    expect(client.refreshToken).toHaveBeenCalledWith({ refreshToken: "stored-refresh" });
    const persisted = JSON.parse(
      cryptoService.encryptToString.mock.calls[0]?.[0] as string,
    ) as TrueLayerCredentialRecord;
    expect(persisted).toMatchObject({
      accessToken: "fresh-access",
      refreshToken: "rotated-refresh",
    });
    expect(updateChain.returning).toHaveBeenCalled();
  });

  it("returns without calling TrueLayer when another worker already refreshed (lock loser)", async () => {
    const { service, client } = createService({
      storedRecord: {
        accessToken: "already-refreshed",
        refreshToken: "already-rotated",
        expiresAt: FUTURE,
      },
    });

    const token = await service.getAccessToken(createContext());

    expect(token).toBe("already-refreshed");
    expect(client.refreshToken).not.toHaveBeenCalled();
  });

  it("coalesces concurrent refreshes in-process into a single upstream call", async () => {
    let release: (value: TokenResponse) => void = () => {};
    const gate = new Promise<TokenResponse>((resolve) => {
      release = resolve;
    });
    const { service, client } = createService();
    client.refreshToken.mockImplementation(() => gate);

    const first = service.getAccessToken(createContext());
    const second = service.getAccessToken(createContext());
    release(tokenResponse());

    await expect(first).resolves.toBe("fresh-access");
    await expect(second).resolves.toBe("fresh-access");
    expect(client.refreshToken).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing refresh token when the response does not rotate it", async () => {
    const { service, cryptoService } = createService({
      refresh: tokenResponse({ refreshToken: null }),
    });

    await service.getAccessToken(createContext());

    const persisted = JSON.parse(
      cryptoService.encryptToString.mock.calls[0]?.[0] as string,
    ) as TrueLayerCredentialRecord;
    expect(persisted.refreshToken).toBe("stored-refresh");
  });

  it("maps a dead grant (invalid_grant) to the terminal ConnectorAuthError", async () => {
    const { service } = createService({
      refresh: new TrueLayerAuthError("invalid_grant", "grant revoked", 400),
    });

    await expect(service.getAccessToken(createContext())).rejects.toBeInstanceOf(
      ConnectorAuthError,
    );
  });

  it("maps other refresh failures to a transient typed error", async () => {
    const { service } = createService({ refresh: new Error("socket hang up") });

    const error = await service.getAccessToken(createContext()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConnectorError);
    expect(error).not.toBeInstanceOf(ConnectorAuthError);
    expect((error as ConnectorError).code).toBe("TOKEN_REFRESH_FAILED");
  });
});
