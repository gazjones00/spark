import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { loggerOptions, REDACTED } from "./index";

function createCapturingLogger() {
  const lines: string[] = [];
  const destination = {
    write(line: string) {
      lines.push(line);
    },
  };
  // Force no transport so output is captured synchronously in-memory.
  const logger = pino({ ...loggerOptions, transport: undefined, level: "info" }, destination);
  return { logger, lines };
}

describe("loggerOptions redaction", () => {
  it("redacts token/secret fields at the top level and one level deep", () => {
    const { logger, lines } = createCapturingLogger();

    logger.info({
      access_token: "secret-access",
      refresh_token: "secret-refresh",
      accessToken: "secret-camel-access",
      refreshToken: "secret-camel-refresh",
      client_secret: "secret-client",
      clientSecret: "secret-camel-client",
      password: "secret-password",
      authorization: "Bearer secret-bearer",
      response: {
        access_token: "nested-access",
        refresh_token: "nested-refresh",
        clientSecret: "nested-client",
      },
      safe: "visible",
    });

    const output = lines.join("\n");
    expect(output).toContain("visible");
    expect(output).toContain(REDACTED);
    for (const secret of [
      "secret-access",
      "secret-refresh",
      "secret-camel-access",
      "secret-camel-refresh",
      "secret-client",
      "secret-camel-client",
      "secret-password",
      "secret-bearer",
      "nested-access",
      "nested-refresh",
      "nested-client",
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it("redacts request authorization/cookie headers", () => {
    const { logger, lines } = createCapturingLogger();
    logger.info({
      req: { headers: { authorization: "Bearer abc123", cookie: "session=xyz789" } },
    });
    const output = lines.join("\n");
    expect(output).not.toContain("abc123");
    expect(output).not.toContain("xyz789");
  });

  it("normalises errors logged under `err`, dropping payload-bearing fields", () => {
    const { logger, lines } = createCapturingLogger();

    // Shaped like a TrueLayer token-exchange failure: secrets live in
    // response/config/cause, which console.error used to spill verbatim.
    const error = new Error("Request failed with status code 400") as Error & {
      response: unknown;
      config: unknown;
    };
    error.response = {
      data: { access_token: "live-access-token", refresh_token: "live-refresh-token" },
    };
    error.config = { data: "client_id=abc&client_secret=live-client-secret" };
    (error as { cause?: unknown }).cause = { accessToken: "live-cause-token" };

    logger.error({ err: error }, "orpc handler error");

    const output = lines.join("\n");
    expect(output).toContain("Request failed with status code 400");
    for (const secret of [
      "live-access-token",
      "live-refresh-token",
      "live-client-secret",
      "live-cause-token",
    ]) {
      expect(output).not.toContain(secret);
    }
  });
});
