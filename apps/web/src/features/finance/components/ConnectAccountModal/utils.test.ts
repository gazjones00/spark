import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import { describeConnectError } from "./utils";

describe("describeConnectError", () => {
  it("branches structurally on a defined NEEDS_REAUTH error (AC-4)", () => {
    const error = new ORPCError("NEEDS_REAUTH", {
      defined: true,
      status: 403,
      data: { connectionId: "conn-1" },
    });
    const described = describeConnectError(error);
    expect(described.recoverable).toBe(true);
    expect(described.message).toContain("reauthorised");
  });

  it("maps INVALID_OAUTH_STATE to a reconnect prompt", () => {
    const error = new ORPCError("INVALID_OAUTH_STATE", { defined: true, status: 401 });
    const described = describeConnectError(error);
    expect(described.recoverable).toBe(true);
    expect(described.message).toContain("reconnect");
  });

  it("treats RATE_LIMITED as non-recoverable with a wait message", () => {
    const error = new ORPCError("RATE_LIMITED", { defined: true, status: 429 });
    const described = describeConnectError(error);
    expect(described.recoverable).toBe(false);
    expect(described.message).toContain("try again");
  });

  it("maps CONNECTOR_ERROR to a non-recoverable retry-later message", () => {
    const error = new ORPCError("CONNECTOR_ERROR", {
      defined: true,
      status: 502,
      data: { code: "PROVIDER_UNAVAILABLE" },
    });
    const described = describeConnectError(error);
    expect(described.recoverable).toBe(false);
    expect(described.message).toContain("try again");
  });

  it("falls back to error.message for undefined errors", () => {
    const described = describeConnectError(new Error("network exploded"));
    expect(described).toEqual({ message: "network exploded", recoverable: false });
  });

  it("does not treat a plain Error with a matching message as defined", () => {
    const described = describeConnectError(new Error("NEEDS_REAUTH"));
    expect(described.recoverable).toBe(false);
  });
});
