import { describe, expect, it } from "vitest";
import type { PlanItem } from "./maintenance.js";
import { buildOilLog, findOilItem, type OilRecord } from "./oilLog.js";

const plan: PlanItem[] = [
  { id: "huile-boite", name: "Huile de boîte", category: "transmission", action: "vidanger", intervalKm: 60000, intervalMonths: null, note: "" },
  { id: "vidange-huile", name: "Vidange huile moteur + filtre à huile", category: "moteur", action: "vidanger", intervalKm: 15000, intervalMonths: 12, note: "" },
  { id: "filtre-air", name: "Filtre à air", category: "filtres", action: "remplacer", intervalKm: 30000, intervalMonths: 24, note: "" },
];

const rec = (id: string, itemId: string, km: number, date: string, costTnd: number | null = null): OilRecord => ({
  id,
  itemId,
  itemName: null,
  doneAtKm: km,
  doneAt: new Date(`${date}T12:00:00`),
  costTnd,
  note: null,
});

const NOW = new Date("2026-11-25T12:00:00");

describe("findOilItem", () => {
  it("picks the engine oil change, never gearbox oil", () => {
    expect(findOilItem(plan)?.id).toBe("vidange-huile");
    expect(findOilItem([plan[0]!, plan[2]!])).toBeNull();
  });
  it("recognises other ids for the engine oil change", () => {
    expect(findOilItem([{ ...plan[1]!, id: "huile-moteur" }])?.id).toBe("huile-moteur");
  });
});

describe("buildOilLog", () => {
  it("lists oil changes newest first with gaps, same-day services and what is left", () => {
    const log = buildOilLog(
      plan,
      [
        rec("a", "vidange-huile", 44000, "2025-11-10", 120),
        rec("b", "vidange-huile", 59200, "2026-11-20", 150),
        rec("c", "filtre-air", 59200, "2026-11-20"),
      ],
      61000,
      null,
      NOW,
    );
    expect(log.item?.intervalKm).toBe(15000);
    expect(log.entries.map((e) => e.recordId)).toEqual(["b", "a"]);
    expect(log.entries[0]).toMatchObject({ date: "2026-11-20", km: 59200, kmSincePrevious: 15200, monthsSincePrevious: 12, alsoDone: ["Filtre à air"] });
    expect(log.entries[1]).toMatchObject({ kmSincePrevious: null, alsoDone: [] });
    expect(log.next).toMatchObject({ status: "ok", nextDueKm: 74200, kmLeft: 13200, nextDueDate: "2027-11-20", estimated: false });
    expect(log.next?.daysLeft).toBe(360);
    expect(log.next?.used).toBeCloseTo(0.12, 2);
  });

  it("flags an overdue oil change by km or by time", () => {
    const byKm = buildOilLog(plan, [rec("a", "vidange-huile", 40000, "2026-06-01")], 56000, null, NOW);
    expect(byKm.next).toMatchObject({ status: "overdue", kmLeft: -1000 });
    expect(byKm.next!.used).toBeGreaterThan(1);
    const byTime = buildOilLog(plan, [rec("a", "vidange-huile", 50000, "2025-10-01")], 52000, null, NOW);
    expect(byTime.next?.status).toBe("overdue");
    expect(byTime.next!.daysLeft!).toBeLessThan(0);
  });

  it("estimates the next one when no oil change was ever recorded", () => {
    const log = buildOilLog(plan, [], 59200, null, NOW);
    expect(log.entries).toEqual([]);
    expect(log.next).toMatchObject({ estimated: true, nextDueKm: 60000, used: null });
  });

  it("works without mileage and without an oil item", () => {
    expect(buildOilLog(plan, [], null, null, NOW).next).toBeNull();
    expect(buildOilLog([plan[2]!], [], 1000, null, NOW)).toEqual({ item: null, mileageKm: 1000, next: null, entries: [] });
  });
});
