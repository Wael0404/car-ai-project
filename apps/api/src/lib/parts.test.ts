import { describe, expect, it } from "vitest";
import { brandFromTitle, guessPart } from "./parts.js";

describe("brandFromTitle", () => {
  it("takes the capitalised word just before the reference", () => {
    expect(brandFromTitle("Filtre à huile MISFAT L008", "L008")).toBe("MISFAT");
    expect(brandFromTitle("GATES Courroie d'accessoire 5PK1153", "5PK1153")).toBe("GATES"); // maker first
    expect(brandFromTitle("Courroie d'accessoire 5PK1153", "5PK1153")).toBeNull(); // "accessoire" is not a brand
    expect(brandFromTitle("Filtre à air MANN C 2295/3", "C 2295/3")).toBe("MANN");
  });
  it("returns null when the reference is missing or not in the title", () => {
    expect(brandFromTitle("Filtre à huile MISFAT L008", null)).toBeNull();
    expect(brandFromTitle("Filtre à huile", "L008")).toBeNull();
    expect(brandFromTitle("L008 filtre", "L008")).toBeNull();
  });
});

describe("guessPart", () => {
  it.each([
    ["Filtre à huile MISFAT L008", "Filtre à huile"],
    ["Filtre a huile MISFAT Z438 (équivalence WIX WL7252)", "Filtre à huile"],
    ["ELF Evolution Full-Tech C2 5W-30 5 L", "Huile moteur"],
    ["Castrol EDGE Professional LongLife III 5W-30 5 L", "Huile moteur"],
    ["Huile moteur Total Quartz 9000", "Huile moteur"],
    ["GATES Courroie d'accessoire 5PK1153", "Courroie d'accessoires"],
    ["Kit de distribution Dayco KTB123", "Kit de distribution"],
    ["Filtre à air MANN C 2295/3", "Filtre à air"],
    ["Filtre habitacle charbon actif", "Filtre d'habitacle"],
    ["Jeu de 4 plaquettes avant Bosch", "Plaquettes de frein"],
    ["Liquide de frein DOT 4 1L", "Liquide de frein"],
    ["Bougie NGK ZKR7A", "Bougies"],
    ["Article inconnu", "Pièces"],
  ])("%s -> %s", (product, part) => {
    expect(guessPart(product)).toBe(part);
  });
});
