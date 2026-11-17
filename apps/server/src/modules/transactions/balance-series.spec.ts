import { describe, expect, it } from "vitest";
import { movementsFrom, reconstructBalanceSeries, type SeriesAccount } from "./balance-series";

const WINDOW = { from: "2026-06-01", to: "2026-06-05" };

function account(overrides: Partial<SeriesAccount> = {}): SeriesAccount {
  return {
    key: "current",
    type: "CASH",
    currency: "GBP",
    anchorBalance: "100.00",
    anchorDay: "2026-06-05",
    ...overrides,
  };
}

const balances = (points: Array<{ balance: string }>) => points.map((point) => point.balance);

describe("reconstructBalanceSeries", () => {
  it("rebuilds earlier days by undoing the transactions that came after them", () => {
    const points = reconstructBalanceSeries(
      [account()],
      [
        { key: "current", day: "2026-06-03", amount: "-20.00" },
        { key: "current", day: "2026-06-05", amount: "10.00" },
      ],
      WINDOW,
    );

    expect(points.map((point) => point.date)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
    // Ends on the anchor; quiet days carry the previous balance.
    expect(balances(points)).toEqual(["110.00", "110.00", "90.00", "90.00", "100.00"]);
  });

  it("keeps the anchor day's transactions after the snapshot out of the anchor", () => {
    // Snapshot of 100 taken before a -20 later that day: the day ends on 80
    // and the day before stays at 100.
    const points = reconstructBalanceSeries(
      [account({ movedLaterOnAnchorDay: "-20.00" })],
      [{ key: "current", day: "2026-06-05", amount: "-20.00" }],
      WINDOW,
    );

    expect(balances(points).slice(-2)).toEqual(["100.00", "80.00"]);
  });

  it("counts a card's balance, the amount owed, as debt", () => {
    // TrueLayer card convention: purchases raise the (positive) balance owed.
    const points = reconstructBalanceSeries(
      [account({ key: "card", type: "CARD", anchorBalance: "50.00" })],
      [{ key: "card", day: "2026-06-02", amount: "30.00" }],
      WINDOW,
    );

    expect(balances(points)).toEqual(["-20.00", "-50.00", "-50.00", "-50.00", "-50.00"]);
  });

  it("treats an overpaid card (negative amount owed) as money held", () => {
    const points = reconstructBalanceSeries(
      [account({ key: "card", type: "CARD", anchorBalance: "-15.00" })],
      [],
      WINDOW,
    );

    expect(balances(points).at(-1)).toBe("15.00");
  });

  it("sums every account into one net worth, including those that never move", () => {
    const points = reconstructBalanceSeries(
      [
        account(),
        account({ key: "saver", type: "SAVINGS", anchorBalance: "1000.00" }),
        account({ key: "card", type: "CARD", anchorBalance: "40.00" }),
      ],
      [
        { key: "current", day: "2026-06-04", amount: "-25.00" },
        { key: "card", day: "2026-06-04", amount: "25.00" },
      ],
      WINDOW,
    );

    // 125 + 1000 - 15 before the purchase; 100 + 1000 - 40 after it.
    expect(balances(points)).toEqual(["1110.00", "1110.00", "1110.00", "1060.00", "1060.00"]);
  });

  it("applies movements forward from an anchor observed before the window", () => {
    const stale = account({ anchorDay: "2026-05-30" });
    const points = reconstructBalanceSeries(
      [stale],
      [
        { key: "current", day: "2026-05-31", amount: "5.00" },
        { key: "current", day: "2026-06-02", amount: "-10.00" },
      ],
      WINDOW,
    );

    expect(balances(points)).toEqual(["105.00", "95.00", "95.00", "95.00", "95.00"]);
    expect(movementsFrom([stale], WINDOW.from)).toBe("2026-05-30");
  });

  it("sums only the dominant currency, since there is no FX conversion", () => {
    const points = reconstructBalanceSeries(
      [
        account(),
        account({ key: "saver", anchorBalance: "50.00" }),
        account({ key: "euro", currency: "EUR", anchorBalance: "999.00" }),
      ],
      [],
      WINDOW,
    );

    expect(points.every((point) => point.currency === "GBP")).toBe(true);
    expect(balances(points).at(-1)).toBe("150.00");
  });

  it("returns no points without any account balance to anchor on", () => {
    expect(reconstructBalanceSeries([], [], WINDOW)).toEqual([]);
  });
});
