import { describe, expect, it } from "vitest";
import { computeCheckDigit, normalizeVin, validateVin } from "./vin.js";

describe("VIN validation", () => {
  it("accepts a valid North American VIN (check digit OK)", () => {
    expect(validateVin("1HGCM82633A004352")).toEqual({ valid: true, vin: "1HGCM82633A004352" });
    expect(computeCheckDigit("1HGCM82633A004352")).toBe("3");
  });

  it("rejects a North American VIN with a wrong check digit", () => {
    expect(validateVin("1HGCM82643A004352").valid).toBe(false);
  });

  it("accepts a European VIN without checking digit 9", () => {
    expect(validateVin("WVWZZZAUZFW123456").valid).toBe(true);
  });

  it("normalizes spaces, dashes and case", () => {
    expect(normalizeVin(" wvwzzz-auzfw 123456 ")).toBe("WVWZZZAUZFW123456");
  });

  it("rejects forbidden letters and wrong lengths", () => {
    expect(validateVin("WVWZZZAUZFW12345O").valid).toBe(false);
    expect(validateVin("WVWZZZ").valid).toBe(false);
  });
});
