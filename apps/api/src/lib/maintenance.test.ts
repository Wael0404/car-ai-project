import { describe, expect, it } from "vitest";
import { computeDue, parseRegistrationDate, type PlanItem } from "./maintenance.js";

const oil: PlanItem = { id: "vidange", name: "Vidange", category: "moteur", action: "vidanger", intervalKm: 15000, intervalMonths: 12, note: "" };
const belt: PlanItem = { id: "courroie", name: "Courroie", category: "distribution", action: "remplacer", intervalKm: 120000, intervalMonths: 72, note: "" };
const brakeFluid: PlanItem = { id: "liquide-frein", name: "Liquide de frein", category: "freinage", action: "remplacer", intervalKm: null, intervalMonths: 24, note: "" };
const now = new Date(2026, 10, 25);

describe("computeDue", () => {
  it("marks an item overdue when its km interval is passed since it was done", () => {
    const [d] = computeDue([oil], 46000, [{ itemId: "vidange", doneAtKm: 30000, doneAt: new Date(2026, 5, 1) }], null, now);
    expect(d!.status).toBe("overdue");
    expect(d!.nextDueKm).toBe(45000);
    expect(d!.kmLeft).toBe(-1000);
  });

  it("marks an item soon within 1500 km", () => {
    const [d] = computeDue([oil], 44000, [{ itemId: "vidange", doneAtKm: 30000, doneAt: new Date(2026, 9, 1) }], null, now);
    expect(d!.status).toBe("soon");
  });

  it("assumes routine items were done on schedule when never marked", () => {
    const [d] = computeDue([oil], 61000, [], null, now);
    expect(d!.nextDueKm).toBe(75000);
    expect(d!.status).toBe("ok");
  });

  it("never assumes the timing belt was changed", () => {
    const [d] = computeDue([belt], 125000, [], null, now);
    expect(d!.status).toBe("overdue");
    expect(d!.unknownHistory).toBe(true);
  });

  it("uses time for time-only items, from the last time it was done", () => {
    const [d] = computeDue([brakeFluid], 50000, [{ itemId: "liquide-frein", doneAtKm: 20000, doneAt: new Date(2024, 0, 1) }], null, now);
    expect(d!.status).toBe("overdue");
    expect(d!.nextDueDate).toBe("2026-01-01");
  });

  it("sorts overdue first", () => {
    const items = computeDue([oil, belt], 125000, [{ itemId: "vidange", doneAtKm: 124000, doneAt: now }], null, now);
    expect(items.map((i) => i.id)).toEqual(["courroie", "vidange"]);
  });
});

describe("parseRegistrationDate", () => {
  it("reads the Tunisian card format and ISO", () => {
    expect(parseRegistrationDate("2020/11/30")?.getFullYear()).toBe(2020);
    expect(parseRegistrationDate("30/11/2020")?.getMonth()).toBe(10);
    expect(parseRegistrationDate("nope")).toBeNull();
  });
});
