import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { BodyType } from "../agent/schema.js";

/**
 * Which 3D model the app shows for a vehicle.
 *
 * - "glb": a real 3D model (glTF binary) of that make/model/generation. The
 *   app repaints the car body with the user's color.
 * - "procedural": no model yet for that car, the app draws a generic car of
 *   the right body type (sedan, SUV...) in the user's color.
 *
 * In development the files are served by the API from apps/api/models
 * (MODELS_CDN_URL=http://<pc-ip>:3100/models). In production, put them on a
 * CDN and point MODELS_CDN_URL to it.
 */
export interface ModelCredit {
  title: string;
  author: string;
  license: string;
  url: string;
}

export type Model3D =
  | { kind: "glb"; url: string; credit: ModelCredit | null }
  | { kind: "procedural"; bodyType: BodyType };

export const MODELS_DIR = fileURLToPath(new URL("../../models/", import.meta.url));
const CDN_BASE = (process.env["MODELS_CDN_URL"] ?? "").replace(/\/$/, "");
/** Development: the API itself serves apps/api/models at /models. */
export const SERVE_MODELS_LOCALLY = process.env["MODELS_SERVE_LOCAL"] === "true";

interface CatalogEntry {
  make: string;
  model: string;
  /** Matched against the agent's "generation" text, e.g. "Panda III (312/319)". */
  generation?: RegExp;
  years?: [number, number];
  file: string;
  credit: ModelCredit | null;
}

const CATALOG: CatalogEntry[] = [
  {
    make: "fiat",
    model: "panda",
    generation: /\b(iii|mk ?3|3e|312|319)\b/i,
    years: [2011, 2025],
    file: "fiat/panda-mk3.glb",
    credit: {
      title: "Fiat Panda MK3 Since 2011",
      author: "szymonpasterczyk",
      license: "CC BY 4.0",
      url: "https://sketchfab.com/3d-models/none-937ce0e375b54b4f9c8120f257df3787",
    },
  },
];

const normalize = (s: string) => s.trim().toLowerCase();

function matches(entry: CatalogEntry, spec: Spec3D): boolean {
  if (normalize(spec.make!) !== entry.make || normalize(spec.model!) !== entry.model) return false;
  if (entry.generation && spec.generation && !entry.generation.test(spec.generation)) return false;
  if (entry.years && spec.modelYear && (spec.modelYear < entry.years[0] || spec.modelYear > entry.years[1])) {
    return false;
  }
  // Without generation or year, a model name alone is too vague (e.g. Panda 1980 vs 2020).
  return Boolean(spec.generation || spec.modelYear || (!entry.generation && !entry.years));
}

interface Spec3D {
  make: string | null;
  model: string | null;
  modelYear: number | null;
  generation: string | null;
  bodyType: string | null;
}

export function resolveModel3D(spec: Spec3D): Model3D {
  if (spec.make && spec.model && CDN_BASE) {
    const entry = CATALOG.find((e) => matches(e, spec));
    // Locally, only offer a model whose file is really there.
    const available = entry && (!SERVE_MODELS_LOCALLY || existsSync(MODELS_DIR + entry.file));
    if (entry && available) {
      return { kind: "glb", url: `${CDN_BASE}/${entry.file}`, credit: entry.credit };
    }
  }
  return { kind: "procedural", bodyType: (spec.bodyType as BodyType | null) ?? "sedan" };
}
