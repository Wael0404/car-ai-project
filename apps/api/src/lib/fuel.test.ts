import { describe, expect, it } from "vitest";
import { conflictsWithFuel, normalizeFuel, planItemFitsFuel } from "./fuel.js";

describe("normalizeFuel", () => {
  it.each([
    ["GO", "Diesel"],
    ["Gazole", "Diesel"],
    ["diesel", "Diesel"],
    ["1.5 dCi 106 ch", "Diesel"],
    ["ES", "Essence"],
    ["Essence", "Essence"],
    ["0.9 TwinAir bicylindre turbo", "Essence"],
    ["Gasoline", "Essence"],
    ["Essence hybride", "Hybride"],
    ["EH", "Hybride"],
    ["EL", "Électrique"],
    ["Électrique", "Électrique"],
    ["GPL", "GPL"],
    ["Essence/GPL", "GPL"],
  ])("%s -> %s", (input, fuel) => {
    expect(normalizeFuel(input)).toBe(fuel);
  });
  it("returns null when it cannot tell", () => {
    expect(normalizeFuel(null)).toBeNull();
    expect(normalizeFuel("")).toBeNull();
    expect(normalizeFuel("1.6 16v")).toBeNull();
    expect(normalizeFuel("goodyear")).toBeNull();
  });
});

describe("conflictsWithFuel", () => {
  it("drops offers made for the other engine", () => {
    expect(conflictsWithFuel("ASHIKA 20-01-134 (OE 16546ED000), pour 1.5 dCi", "Essence")).toBe(true);
    expect(conflictsWithFuel("ASHIKA 20-01-135 (OE 16546JD20B), pour 2.0 essence", "Diesel")).toBe(true);
    expect(conflictsWithFuel("Bougies (essence)", "Diesel")).toBe(true);
    expect(conflictsWithFuel("Filtre à carburant (diesel)", "Essence")).toBe(true);
    expect(conflictsWithFuel("Bougies de préchauffage", "Essence")).toBe(true);
  });
  it("keeps neutral parts and unknown fuel", () => {
    expect(conflictsWithFuel("Filtre à air MISFAT P362", "Diesel")).toBe(false);
    expect(conflictsWithFuel("Huile 5W-30 essence ou diesel", "Diesel")).toBe(false);
    expect(conflictsWithFuel("Filtre à air pour 1.5 dCi", null)).toBe(false);
  });
});

describe("planItemFitsFuel", () => {
  const item = (id: string, name: string, note = "") => ({ id, name, note });
  it("removes spark plugs from a diesel and diesel items from a petrol car", () => {
    expect(planItemFitsFuel(item("bougies", "Remplacement bougies"), "Diesel")).toBe(false);
    expect(planItemFitsFuel(item("bougies", "Remplacement bougies (essence)"), "Diesel")).toBe(false);
    expect(planItemFitsFuel(item("filtre-carburant", "Filtre à carburant (diesel)"), "Essence")).toBe(false);
  });
  it("keeps what applies to both", () => {
    expect(planItemFitsFuel(item("bougies-prechauffage", "Bougies de préchauffage"), "Diesel")).toBe(true);
    expect(planItemFitsFuel(item("filtre-carburant", "Remplacement filtre à carburant"), "Essence")).toBe(true);
    expect(planItemFitsFuel(item("vidange-huile", "Vidange huile moteur + filtre à huile"), "Diesel")).toBe(true);
    expect(planItemFitsFuel(item("bougies", "Remplacement bougies"), null)).toBe(true);
  });
});
