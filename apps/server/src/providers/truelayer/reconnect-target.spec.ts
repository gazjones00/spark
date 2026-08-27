import { describe, expect, it } from "vitest";
import { candidateAccountIds, resolveReconnectTarget } from "./reconnect-target";

const OLDER = new Date("2026-01-01T00:00:00Z");
const NEWER = new Date("2026-06-01T00:00:00Z");

describe("candidateAccountIds", () => {
  it("unions the allow-list with the accounts the connection has synced", () => {
    expect(
      candidateAccountIds({ accountIds: ["acc-1"] }, ["truelayer:account:acc-2"]).sort(),
    ).toEqual(["acc-1", "acc-2"]);
  });

  it("falls back to synced accounts when the connection carries no allow-list", () => {
    expect(candidateAccountIds({}, ["truelayer:account:acc-1"])).toEqual(["acc-1"]);
  });

  it("ignores a malformed allow-list rather than trusting its entries", () => {
    expect(candidateAccountIds({ accountIds: "acc-1" }, [])).toEqual([]);
    expect(candidateAccountIds({ accountIds: [1, null, "acc-1"] }, [])).toEqual(["acc-1"]);
  });

  it("deduplicates an account present in both sources", () => {
    expect(candidateAccountIds({ accountIds: ["acc-1"] }, ["truelayer:account:acc-1"])).toEqual([
      "acc-1",
    ]);
  });
});

describe("resolveReconnectTarget", () => {
  it("matches the connection holding the granted accounts", () => {
    const target = resolveReconnectTarget(
      [{ connectionId: "conn-1", accountIds: ["acc-1", "acc-2"], createdAt: OLDER }],
      ["acc-1", "acc-2"],
    );

    expect(target).toBe("conn-1");
  });

  it("matches on partial overlap, so a narrowed selection still reconnects", () => {
    const target = resolveReconnectTarget(
      [{ connectionId: "conn-1", accountIds: ["acc-1", "acc-2"], createdAt: OLDER }],
      ["acc-2"],
    );

    expect(target).toBe("conn-1");
  });

  it("treats a grant over unrelated accounts as a new connection", () => {
    const target = resolveReconnectTarget(
      [{ connectionId: "conn-1", accountIds: ["acc-1"], createdAt: OLDER }],
      ["acc-9"],
    );

    expect(target).toBeNull();
  });

  it("returns null when the user has no connections yet", () => {
    expect(resolveReconnectTarget([], ["acc-1"])).toBeNull();
  });

  it("returns null when the grant exposes no accounts", () => {
    const target = resolveReconnectTarget(
      [{ connectionId: "conn-1", accountIds: ["acc-1"], createdAt: OLDER }],
      [],
    );

    expect(target).toBeNull();
  });

  it("prefers the widest overlap when several connections share accounts", () => {
    const target = resolveReconnectTarget(
      [
        { connectionId: "conn-narrow", accountIds: ["acc-1"], createdAt: OLDER },
        { connectionId: "conn-wide", accountIds: ["acc-1", "acc-2"], createdAt: NEWER },
      ],
      ["acc-1", "acc-2"],
    );

    expect(target).toBe("conn-wide");
  });

  it("breaks an equal overlap on the oldest connection, so reconnects converge", () => {
    const candidates = [
      { connectionId: "conn-new", accountIds: ["acc-1"], createdAt: NEWER },
      { connectionId: "conn-old", accountIds: ["acc-1"], createdAt: OLDER },
    ];

    expect(resolveReconnectTarget(candidates, ["acc-1"])).toBe("conn-old");
    expect(resolveReconnectTarget([...candidates].reverse(), ["acc-1"])).toBe("conn-old");
  });

  it("counts each shared account once when a candidate lists duplicates", () => {
    const target = resolveReconnectTarget(
      [
        { connectionId: "conn-dupes", accountIds: ["acc-1", "acc-1"], createdAt: OLDER },
        { connectionId: "conn-two", accountIds: ["acc-1", "acc-2"], createdAt: NEWER },
      ],
      ["acc-1", "acc-2"],
    );

    expect(target).toBe("conn-two");
  });
});
