import type { BodyType } from "../agent/schema.js";

/**
 * Which 3D model the app shows for a vehicle.
 *
 * - "glb": a real 3D model (glTF binary) of that exact make/model, hosted on
 *   a CDN. Add entries to CATALOG as you acquire licensed models; the app
 *   repaints the material named "paint" with the user's color.
 * - "procedural": no model yet for that car, the app draws a generic car of
 *   the right body type (sedan, SUV...) in the user's color.
 */
export type Model3D =
  | { kind: "glb"; url: string }
  | { kind: "procedural"; bodyType: BodyType };

const CDN_BASE = process.env["MODELS_CDN_URL"] ?? "";

/** Key: "make|model" in lower case, optionally "|yearFrom-yearTo". */
const CATALOG: Record<string, string> = {
  // "volkswagen|golf|2013-2020": "volkswagen/golf-mk7.glb",
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function resolveModel3D(spec: {
  make: string | null;
  model: string | null;
  modelYear: number | null;
  bodyType: string | null;
}): Model3D {
  if (spec.make && spec.model && CDN_BASE) {
    const prefix = `${normalize(spec.make)}|${normalize(spec.model)}`;
    for (const [key, file] of Object.entries(CATALOG)) {
      const [make, model, years] = key.split("|");
      if (`${make}|${model}` !== prefix) continue;
      if (years && spec.modelYear) {
        const [from, to] = years.split("-").map(Number);
        if (spec.modelYear < from! || spec.modelYear > to!) continue;
      }
      return { kind: "glb", url: `${CDN_BASE}/${file}` };
    }
  }
  return { kind: "procedural", bodyType: (spec.bodyType as BodyType | null) ?? "sedan" };
}
