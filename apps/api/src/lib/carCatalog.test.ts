import { describe, expect, it } from "vitest";
import { buildCatalog, normalizeName } from "./carCatalog.js";

describe("normalizeName", () => {
  it("writes names like the carte grise", () => {
    expect(normalizeName(" Citroën ")).toBe("CITROEN");
    expect(normalizeName("grande  punto")).toBe("GRANDE PUNTO");
    expect(normalizeName("")).toBeNull();
    expect(normalizeName(null)).toBeNull();
  });
});

describe("buildCatalog", () => {
  it("contains common Tunisian makes with their models, sorted", () => {
    const fiat = buildCatalog([]).find((m) => m.name === "FIAT")!;
    expect(fiat.models).toContain("PANDA");
    expect(fiat.models.indexOf("500")).toBeLessThan(fiat.models.indexOf("PANDA"));
  });

  it("adds makes and models seen in the database, merging spellings", () => {
    const cat = buildCatalog([
      { make: "Fiat", model: "Panda" },
      { make: "Fiat", model: "Seicento" },
      { make: "Mercedes", model: "Classe C" },
      { make: "Lada", model: "Niva" },
      { make: null, model: "X" },
    ]);
    const fiat = cat.find((m) => m.name === "FIAT")!;
    expect(fiat.models.filter((m) => m === "PANDA")).toHaveLength(1);
    expect(fiat.models).toContain("SEICENTO");
    expect(cat.find((m) => m.name === "MERCEDES")).toBeUndefined();
    expect(cat.find((m) => m.name === "MERCEDES-BENZ")!.models).toContain("CLASSE C");
    expect(cat.find((m) => m.name === "LADA")!.models).toEqual(["NIVA"]);
    expect(cat.map((m) => m.name)).toEqual([...cat.map((m) => m.name)].sort((a, b) => a.localeCompare(b, "fr", { numeric: true })));
  });
});
