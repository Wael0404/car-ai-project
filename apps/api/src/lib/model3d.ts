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
  | { kind: "glb"; url: string; credit: ModelCredit | null; generated?: boolean }
  | {
      kind: "sketchfab";
      uid: string;
      credit: ModelCredit;
      bodyType: BodyType;
      thumbnailUrl: string | null;
      /** false: closest model of the same generation, another version. */
      exact: boolean;
    }
  | { kind: "photos"; bodyType: BodyType; photos: GalleryPhoto[] }
  | { kind: "procedural"; bodyType: BodyType; searching: boolean };

export interface GalleryPhoto {
  angle: string;
  /** Copy served by our API (relative to the models folder/CDN). */
  file?: string;
  url: string;
  pageUrl: string;
  author: string;
  license: string;
  title: string;
}

/** Row of the CarModel3D table, as needed here. */
export interface CatalogRow {
  status: "SEARCHING" | "FOUND" | "NOT_FOUND";
  sketchfabUid: string | null;
  exactMatch: boolean;
  source: string;
  glbFile: string | null;
  photos?: unknown;
  /** Changes when the model is replaced: used to bust the app cache. */
  updatedAt?: Date;
  title: string | null;
  author: string | null;
  license: string | null;
  viewerUrl: string | null;
  thumbnailUrl: string | null;
}

/**
 * Key shared by every owner of the same car: "make|model|generation|variant".
 * Generation and variant come from the VIN agent, e.g. "Panda III (312/319)"
 * and "standard" or "Cross" (a Panda Cross must not show a regular Panda).
 */
export function modelKey(make: string, model: string, generation: string | null, variant: string | null): string {
  const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return [clean(make), clean(model), generation ? clean(generation) : "", clean(variant || "standard")]
    .join("|")
    .slice(0, 200);
}

export const MODELS_DIR = fileURLToPath(new URL("../../models/", import.meta.url));
const CDN_BASE = (process.env["MODELS_CDN_URL"] ?? "").replace(/\/$/, "");
/** Development: the API itself serves apps/api/models at /models. */
export const SERVE_MODELS_LOCALLY = process.env["MODELS_SERVE_LOCAL"] === "true";

/** Public URL of a file stored in the models folder (photos, parts...), null without a CDN. */
export function assetUrl(file: string): string | null {
  return CDN_BASE ? `${CDN_BASE}/${file}` : null;
}

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

export interface Spec3D {
  make: string | null;
  model: string | null;
  modelYear: number | null;
  generation: string | null;
  bodyType: string | null;
}

export function resolveModel3D(spec: Spec3D, row?: CatalogRow | null): Model3D {
  const bodyType = (spec.bodyType as BodyType | null) ?? "sedan";
  if (spec.make && spec.model && CDN_BASE) {
    const entry = CATALOG.find((e) => matches(e, spec));
    // Locally, only offer a model whose file is really there.
    const available = entry && (!SERVE_MODELS_LOCALLY || existsSync(MODELS_DIR + entry.file));
    if (entry && available) {
      return { kind: "glb", url: `${CDN_BASE}/${entry.file}`, credit: entry.credit };
    }
  }
  // Real photos of the exact car (no artist 3D model of it exists).
  if (row?.status === "FOUND" && row.source === "photos" && Array.isArray(row.photos) && row.photos.length > 0) {
    const version = row.updatedAt?.getTime() ?? 0;
    const photos = (row.photos as GalleryPhoto[]).map((p) => ({
      ...p,
      // Serve our own copy; the original Wikimedia URL blocks app clients.
      url: p.file && CDN_BASE ? `${CDN_BASE}/${p.file}?v=${version}` : p.url,
    }));
    return { kind: "photos", bodyType, photos };
  }
  // Model generated by AI from a free photo of the exact car.
  if (row?.status === "FOUND" && row.source === "generated" && row.glbFile && CDN_BASE) {
    return {
      kind: "glb",
      url: `${CDN_BASE}/${row.glbFile}?v=${row.updatedAt?.getTime() ?? 0}`,
      generated: true,
      credit: {
        title: `Modèle 3D généré par IA d'après la photo « ${row.title ?? "Wikimedia Commons"} »`,
        author: row.author ?? "Wikimedia Commons",
        license: row.license ?? "",
        url: row.viewerUrl ?? "https://commons.wikimedia.org",
      },
    };
  }
  // Model found and validated by the AI agent, shown with the Sketchfab viewer.
  if (row?.status === "FOUND" && row.sketchfabUid) {
    return {
      kind: "sketchfab",
      uid: row.sketchfabUid,
      bodyType,
      thumbnailUrl: row.thumbnailUrl,
      exact: row.exactMatch,
      credit: {
        title: row.title ?? "Modèle 3D",
        author: row.author ?? "inconnu",
        license: row.license ?? "Sketchfab",
        url: row.viewerUrl ?? `https://sketchfab.com/3d-models/${row.sketchfabUid}`,
      },
    };
  }
  return { kind: "procedural", bodyType, searching: row?.status === "SEARCHING" };
}
