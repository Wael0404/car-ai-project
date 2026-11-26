import { describe, expect, it } from "vitest";
import { parseServiceDate } from "../lib/maintenance.js";

const NOW = new Date("2026-11-25T09:00:00");

describe("parseServiceDate", () => {
  it("accepts past days and today, at noon local time", () => {
    const d = parseServiceDate("2026-03-14", NOW)!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 14, 12]);
    expect(parseServiceDate("2026-11-25", NOW)).not.toBeNull();
  });
  it("rejects future days, impossible days and very old dates", () => {
    expect(parseServiceDate("2026-11-26", NOW)).toBeNull();
    expect(parseServiceDate("2026-02-30", NOW)).toBeNull();
    expect(parseServiceDate("2026-13-01", NOW)).toBeNull();
    expect(parseServiceDate("1975-05-01", NOW)).toBeNull();
  });
});
