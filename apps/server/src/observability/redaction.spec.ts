import { describe, expect, it } from "vitest";
import { normalizeError, REDACTED, redactSensitive } from "./redaction";

describe("redactSensitive", () => {
  it("redacts sensitive keys at any depth", () => {
    const input = {
      access_token: "tok-top",
      nested: {
        refreshToken: "tok-nested",
        deeper: { client_secret: "shh", list: [{ password: "pw" }] },
      },
      safe: "keep-me",
    };

    const result = redactSensitive(input) as Record<string, unknown>;

    expect(result.access_token).toBe(REDACTED);
    expect(result.safe).toBe("keep-me");
    const nested = result.nested as Record<string, unknown>;
    expect(nested.refreshToken).toBe(REDACTED);
    const deeper = nested.deeper as Record<string, unknown>;
    expect(deeper.client_secret).toBe(REDACTED);
    expect((deeper.list as Record<string, unknown>[])[0].password).toBe(REDACTED);
    expect(JSON.stringify(result)).not.toMatch(/tok-top|tok-nested|shh|pw"/);
  });

  it("is case-insensitive on key names", () => {
    const result = redactSensitive({ AccessToken: "a", CLIENT_SECRET: "b" }) as Record<
      string,
      unknown
    >;
    expect(result.AccessToken).toBe(REDACTED);
    expect(result.CLIENT_SECRET).toBe(REDACTED);
  });

  it("survives circular references", () => {
    const input: Record<string, unknown> = { safe: "ok" };
    input.self = input;
    const result = redactSensitive(input) as Record<string, unknown>;
    expect(result.safe).toBe("ok");
    expect(result.self).toBe(REDACTED);
  });
});

describe("normalizeError", () => {
  it("keeps name/message/code/status/stack and drops payload-bearing fields", () => {
    const error = new Error("token exchange failed") as Error & {
      code: string;
      status: number;
      response: unknown;
      config: unknown;
    };
    error.code = "TOKEN_EXCHANGE_FAILED";
    error.status = 502;
    error.response = { access_token: "secret-access", refresh_token: "secret-refresh" };
    error.config = { client_secret: "super-secret" };
    (error as { cause?: unknown }).cause = { accessToken: "secret-cause" };

    const normalized = normalizeError(error);

    expect(normalized).toMatchObject({
      name: "Error",
      message: "token exchange failed",
      code: "TOKEN_EXCHANGE_FAILED",
      status: 502,
    });
    expect(normalized.stack).toContain("token exchange failed");
    const serialized = JSON.stringify(normalized);
    expect(serialized).not.toContain("secret-access");
    expect(serialized).not.toContain("secret-refresh");
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("secret-cause");
    expect(serialized).not.toContain("response");
    expect(serialized).not.toContain("cause");
  });

  it("handles non-Error values without leaking secrets", () => {
    const normalized = normalizeError({ message: "boom", access_token: "leaky" });
    expect(normalized.name).toBe("UnknownError");
    expect(normalized.message).not.toContain("leaky");
  });

  it("wraps plain strings", () => {
    expect(normalizeError("plain failure")).toEqual({ name: "Error", message: "plain failure" });
  });
});
