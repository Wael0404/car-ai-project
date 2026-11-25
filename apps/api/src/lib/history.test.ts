import { describe, expect, it } from "vitest";
import { buildReport } from "./history.js";

const now = new Date(2026, 10, 25);

describe("buildReport", () => {
  it("sums spending per month (12 zero-filled months) and per category", () => {
    const r = buildReport(
      [
        { id: "1", itemId: "vidange", itemName: "Vidange", category: "moteur", doneAtKm: 60000, costTnd: 180, doneAt: new Date(2026, 10, 2) },
        { id: "2", itemId: "plaquettes", itemName: "Plaquettes", category: "freinage", doneAtKm: 61000, costTnd: 120.5, doneAt: new Date(2026, 8, 10) },
        { id: "3", itemId: "pneus", itemName: "Pneus", category: "pneus", doneAtKm: 50000, costTnd: null, doneAt: new Date(2024, 0, 1) },
      ],
      [],
      now,
    );
    expect(r.spendByMonth).toHaveLength(12);
    expect(r.spendByMonth.at(-1)).toEqual({ month: "2026-11", totalTnd: 180 });
    expect(r.spendByMonth.find((m) => m.month === "2026-09")?.totalTnd).toBe(120.5);
    expect(r.totals.spentTnd).toBe(300.5);
    expect(r.totals.servicesDone).toBe(3);
    expect(r.spendByCategory[0]).toEqual({ category: "moteur", totalTnd: 180, count: 1 });
    expect(r.records[0]!.id).toBe("1");
  });

  it("builds the mileage series and the average km per month", () => {
    const r = buildReport(
      [],
      [
        { createdAt: new Date(2026, 9, 1), data: { fromKm: null, toKm: 58000 } },
        { createdAt: new Date(2026, 10, 1), data: { fromKm: 58000, toKm: 59200 } },
      ],
      now,
    );
    expect(r.mileage.map((p) => p.km)).toEqual([58000, 59200]);
    expect(r.totals.avgKmPerMonth).toBeGreaterThan(1100);
    expect(r.totals.avgKmPerMonth).toBeLessThan(1300);
    expect(r.totals.lastMileageKm).toBe(59200);
  });

  it("gives no average from a single reading", () => {
    const r = buildReport([], [{ createdAt: now, data: { toKm: 1000 } }], now);
    expect(r.totals.avgKmPerMonth).toBeNull();
  });
});
