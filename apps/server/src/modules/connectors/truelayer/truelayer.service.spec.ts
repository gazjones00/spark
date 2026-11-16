import { env } from "@spark/env/server";
import { describe, expect, it } from "vitest";
import { TruelayerService } from "./truelayer.service";

// The redirect builders read only `env.CORS_ORIGIN`, so the injected
// collaborators are never touched.
function createService() {
  return new TruelayerService(
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );
}

describe("TruelayerService callback redirects", () => {
  it("sends a granted consent to the connect page with code and state", () => {
    const url = new URL(createService().buildCallbackRedirectUrl("auth-code", "state-1"));

    expect(url.origin).toBe(new URL(env.CORS_ORIGIN).origin);
    expect(url.pathname).toBe("/accounts/connect");
    expect(url.searchParams.get("code")).toBe("auth-code");
    expect(url.searchParams.get("state")).toBe("state-1");
  });

  it("omits state when the dialog echoed none back", () => {
    const url = new URL(createService().buildCallbackRedirectUrl("auth-code"));

    expect(url.searchParams.has("state")).toBe(false);
  });

  it("forwards a TrueLayer error code to the connect page", () => {
    const url = new URL(createService().buildCallbackErrorRedirectUrl("ACCESS_DENIED"));

    expect(url.pathname).toBe("/accounts/connect");
    expect(url.searchParams.get("error")).toBe("access_denied");
    expect(url.searchParams.has("code")).toBe(false);
  });

  it("collapses a missing or unslug-shaped error code to the generic failure", () => {
    const service = createService();

    for (const input of [undefined, "", "not a code", "<script>", "a".repeat(65)]) {
      const url = new URL(service.buildCallbackErrorRedirectUrl(input));
      expect(url.searchParams.get("error")).toBe("connection_failed");
    }
  });
});
