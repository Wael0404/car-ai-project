import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Logger } from "pino";
import { MODELS_DIR } from "./model3d.js";
import { storePartImage } from "./partImages.js";
import { guessPart } from "./parts.js";
import { searchShops } from "./productPage.js";

/**
 * Last resort so a part always has a photo: one typical product photo per
 * part type (taken from a shop search, white background), shown as
 * "Photo indicative" when the offer's own photo cannot be found.
 */

/** Part type (see guessPart) -> what to search in the shops. */
const QUERIES: Record<string, string> = {
  "Filtre à huile": "filtre a huile",
  "Filtre à air": "filtre a air",
  "Filtre d'habitacle": "filtre habitacle",
  "Filtre à carburant": "filtre gasoil",
  "Kit de distribution": "kit distribution",
  "Courroie d'accessoires": "courroie accessoire",
  "Plaquettes de frein": "plaquette frein",
  "Disques de frein": "disque frein",
  "Liquide de frein": "liquide de frein",
  "Liquide de refroidissement": "liquide de refroidissement",
  Bougies: "bougie allumage",
  Batterie: "batterie",
  Pneus: "pneu",
  "Balais d'essuie-glace": "essuie glace",
  "Huile moteur": "huile moteur 5w30",
};

/** Words the title must contain when the family name is ambiguous. */
const MUST_SAY: Record<string, RegExp> = {
  // Not a timing belt: a ribbed (poly-V) accessory belt.
  "Courroie d'accessoires": /accessoire|alternateur|\d\s?pk\s?\d|\bpk\b|poly|multi|trap[ée]zo/i,
  // Not a diesel glow plug: a spark plug.
  Bougies: /allumage|iridium|platin|\bngk\b|denso|champion/i,
};

/** Products of the right family that are still not the part itself (battery water...). */
const NOT_THE_PART: Record<string, RegExp> = {
  Batterie: /\beau\b|chargeur|booster|cosse|c[aâ]ble|testeur|d[ée]marreur/i,
  Pneus: /valve|gonfl|compresseur|r[ée]paration|chaîne|chaine/i,
  Bougies: /pr[ée]chauffage|chauffage|chauffe|glow|c[aâ]ble|cl[ée]/i,
  "Courroie d'accessoires": /distribution|zahnriemen|crant[ée]e?|timing/i,
  "Plaquettes de frein": /t[ée]moin|capteur|graisse/i,
  "Liquide de refroidissement": /bouchon|vase|durite/i,
  "Huile moteur": /bo[iî]te|transmission|frein|direction|pompe|2t\b|hydraulique/i,
};

// v3: photos checked against the part type (shop search order is not relevance), trimmed in two passes.
const INDEX = path.join(MODELS_DIR, "parts", "indicative-v3.json");
let cache: { at: number; files: Record<string, string> } | null = null;

function readIndex(): Record<string, string> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.files;
  let files: Record<string, string> = {};
  try {
    files = JSON.parse(readFileSync(INDEX, "utf8")) as Record<string, string>;
  } catch {
    // not built yet
  }
  cache = { at: Date.now(), files };
  return files;
}

/** Typical photo for this part (offer's "part" or product title), or null. */
export function indicativeFile(part: string): string | null {
  const type = Object.hasOwn(QUERIES, part) ? part : guessPart(part);
  const file = readIndex()[type];
  return file && existsSync(path.join(MODELS_DIR, file)) ? file : null;
}

/** Fetches the missing typical photos (worker start; one shop search each, no AI). */
export async function ensureIndicativePhotos(log: Logger): Promise<void> {
  const files = { ...readIndex() };
  let added = 0;
  for (const [type, query] of Object.entries(QUERIES)) {
    if (files[type] && existsSync(path.join(MODELS_DIR, files[type]))) continue;
    try {
      // Only a product whose title is really this kind of part.
      const hit = await searchShops(
        query,
        (h) => guessPart(h.title) === type && (MUST_SAY[type]?.test(h.title) ?? true) && !NOT_THE_PART[type]?.test(h.title),
      );
      const file = hit ? await storePartImage(hit.imageUrl) : null;
      if (file) {
        files[type] = file;
        added++;
      }
    } catch (err) {
      log.warn({ type, err: (err as Error).message }, "Indicative photo not found");
    }
  }
  if (added > 0) {
    await mkdir(path.dirname(INDEX), { recursive: true });
    await writeFile(INDEX, JSON.stringify(files, null, 1));
    cache = null;
  }
  log.info({ types: Object.keys(files).length, added }, "Indicative part photos ready");
}
