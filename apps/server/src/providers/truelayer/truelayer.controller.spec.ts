import { BadRequestException } from "@nestjs/common";
import { call } from "@orpc/server";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { AuthLinkResponseSchema, SaveAccountsResponseSchema } from "@spark/schema";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { InvalidOauthStateError, type TruelayerService } from "./truelayer.service";
import { TruelayerController } from "./truelayer.controller";

const SESSION = { user: { id: "user-1" } } as UserSession;
const STATE = "11111111-2222-4333-8444-555555555555";

function createController(overrides: Partial<Record<keyof TruelayerService, unknown>> = {}) {
  const service = {
    generateAuthLink: vi
      .fn()
      .mockResolvedValue({ url: "https://auth.truelayer.com/?client_id=x", state: STATE }),
    exchangeCode: vi.fn().mockResolvedValue({ state: STATE, accounts: [] }),
    saveAccounts: vi.fn().mockResolvedValue({ savedCount: 2 }),
    buildCallbackRedirectUrl: vi.fn(
      (code: string, state: string) =>
        `https://app.test/accounts/connect?code=${code}&state=${state}`,
    ),
    ...overrides,
  };
  const controller = new TruelayerController(service as unknown as TruelayerService);
  return { controller, service };
}

// The ORPCGlobalContext requires the express request (module augmentation in
// app.module); these in-process handler tests never read it.
const ORPC_CONTEXT = { context: { request: {} as Request } };

describe("TruelayerController contract conformance", () => {
  it("generateAuthLink output parses against AuthLinkResponseSchema", async () => {
    const { controller, service } = createController();

    const result = await call(
      controller.generateAuthLink(SESSION),
      { providerId: "mock-bank" },
      ORPC_CONTEXT,
    );

    expect(() => AuthLinkResponseSchema.parse(result)).not.toThrow();
    expect(service.generateAuthLink).toHaveBeenCalledWith({
      providerId: "mock-bank",
      userId: "user-1",
    });
  });

  it("saveAccounts output parses against SaveAccountsResponseSchema", async () => {
    const { controller } = createController();

    const result = await call(
      controller.saveAccounts(SESSION),
      {
        state: STATE,
        accountIds: ["acc-1", "acc-2"],
      },
      ORPC_CONTEXT,
    );

    expect(() => SaveAccountsResponseSchema.parse(result)).not.toThrow();
  });

  it("maps InvalidOauthStateError to the typed INVALID_OAUTH_STATE channel without leaking detail", async () => {
    const internal = new InvalidOauthStateError("token row missing for state; storage degraded");
    const { controller } = createController({
      exchangeCode: vi.fn().mockRejectedValue(internal),
    });

    const error = await call(
      controller.exchangeCode(SESSION),
      {
        code: "auth-code",
        state: STATE,
      },
      ORPC_CONTEXT,
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "INVALID_OAUTH_STATE", status: 401 });
    expect((error as Error).message).not.toContain("storage degraded");
  });

  it("rejects a non-uuid oauth state before reaching the service", async () => {
    const { controller, service } = createController();

    await expect(
      call(controller.exchangeCode(SESSION), { code: "auth-code", state: "forged" }, ORPC_CONTEXT),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.exchangeCode).not.toHaveBeenCalled();
  });
});

describe("TruelayerController.callback (the one non-oRPC edge)", () => {
  it("redirects to the service-built URL for a valid query", () => {
    const { controller, service } = createController();
    const res = { redirect: vi.fn() } as unknown as Response;

    controller.callback({ code: "auth-code", state: STATE }, res);

    expect(service.buildCallbackRedirectUrl).toHaveBeenCalledWith("auth-code", STATE);
    expect(res.redirect).toHaveBeenCalledWith(
      `https://app.test/accounts/connect?code=auth-code&state=${STATE}`,
    );
  });

  it("rejects malformed callback queries with a 400 and never redirects", () => {
    const { controller } = createController();
    const res = { redirect: vi.fn() } as unknown as Response;

    expect(() => controller.callback({ unexpected: "junk" }, res)).toThrow(BadRequestException);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
