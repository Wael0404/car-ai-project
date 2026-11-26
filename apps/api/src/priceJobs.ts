import type { Logger } from "pino";
import { lookupPrices } from "./agent/priceAgent.js";
import type { VehicleProfile } from "./agent/schema.js";
import { prisma } from "./lib/db.js";
import type { PlanItem } from "./lib/maintenance.js";
import { storePartImage } from "./lib/partImages.js";
import { fetchProductInfo, isAllowedShopUrl, pageContradicts, searchShops, squash } from "./lib/productPage.js";
import { enqueuePriceEnrichment, enqueuePriceLookup, type PriceJobData } from "./lib/queue.js";

/** Prices change slowly: a lookup is reused 30 days, then refreshed on the next view. */
export const PRICE_TTL_MS = 30 * 24 * 3600 * 1000;

/** One offer as stored (older rows only have shop, product, priceTnd, url). */
export interface StoredOffer {
  part?: string;
  shop: string;
  product: string;
  brand?: string | null;
  reference?: string | null;
  priceTnd: number | null;
  url: string;
  /** Part photo copied to our storage, relative to the models folder. */
  imageFile?: string | null;
  /** True once the product page was read (photo/reference), even if nothing was found. */
  enriched?: boolean;
  /** Version of the enrichment that ran (older offers are enriched again). */
  enrichVersion?: number;
  /** Failed attempts to read the page (it is given up after MAX_ENRICH_TRIES). */
  enrichTries?: number;
  /** A shop search by reference was already tried for this offer. */
  refSearched?: boolean;
}

const MAX_ENRICH_TRIES = 2;
/** 2: photo by same reference / shop search. 3: photos trimmed in two passes. */
export const ENRICH_VERSION = 3;
/** Shop searches by reference per lookup (polite to the shop, fast). */
const MAX_REF_SEARCHES = 4;

const isCurrent = (o: StoredOffer) => o.enriched === true && (o.enrichVersion ?? 1) >= ENRICH_VERSION;

export const needsEnrichment = (offers: unknown): boolean =>
  Array.isArray(offers) && offers.some((o) => !isCurrent(o as StoredOffer));

/**
 * Returns the cached prices, or queues a lookup (only when an owner opens the
 * item, so nothing is spent on items nobody looks at). Offers saved before
 * photos/references existed get them added in the background, for free.
 */
export async function getOrQueuePrices(key: string, profile: VehicleProfile, item: PlanItem) {
  const row = await prisma.partPrices.findUnique({ where: { key } });
  const fresh = row && Date.now() - row.updatedAt.getTime() < PRICE_TTL_MS;
  if (row && (row.status === "PENDING" || (fresh && row.status !== "FAILED"))) {
    const enriching = row.status === "READY" && needsEnrichment(row.offers);
    if (enriching) await enqueuePriceEnrichment(key);
    return { row, enriching };
  }
  // Missing, stale, or failed more than a day ago: (re)queue.
  if (row?.status === "FAILED" && Date.now() - row.updatedAt.getTime() < 24 * 3600 * 1000) return { row, enriching: false };

  const saved = await prisma.partPrices.upsert({
    where: { key },
    update: { status: "PENDING", error: null },
    create: { key },
  });
  await enqueuePriceLookup({ key, profile, item });
  return { row: saved, enriching: false };
}

/**
 * Photo and reference of each offer, free (no AI):
 * 1. the shop's product page (3 at a time);
 * 2. the photo of another offer with the same reference;
 * 3. a shop search by reference (only a product whose title has that exact reference).
 * When none works, the app shows a typical photo of the part ("Photo indicative").
 */
export async function enrichOffers(offers: StoredOffer[], log: Logger): Promise<StoredOffer[]> {
  const out: StoredOffer[] = [];
  for (let i = 0; i < offers.length; i += 3) {
    const batch = await Promise.all(
      offers.slice(i, i + 3).map(async (src): Promise<StoredOffer> => {
        if (isCurrent(src)) return src;
        // Offer read by an older version: start again (new photo encoding, new fallbacks).
        const o: StoredOffer =
          (src.enrichVersion ?? 1) < ENRICH_VERSION ? { ...src, enriched: false, enrichTries: 0, imageFile: null, refSearched: false } : src;
        const done = (x: StoredOffer): StoredOffer => ({ ...x, enriched: true, enrichVersion: ENRICH_VERSION });
        if (!isAllowedShopUrl(o.url)) return done(o);
        // A temporary failure (timeout, 429/503, disk) is retried once on a later view.
        const failed = (why: string): StoredOffer => {
          const tries = (o.enrichTries ?? 0) + 1;
          log.warn({ url: o.url, why, tries }, "Product page not read");
          return tries >= MAX_ENRICH_TRIES ? done({ ...o, enrichTries: tries }) : { ...o, enrichTries: tries, enriched: false };
        };
        try {
          const info = await fetchProductInfo(o.url, o.product);
          if (!info) return failed("page unavailable");
          if (pageContradicts(o.product, o.reference, info)) {
            // The link shows another product: keep the agent's data, no photo.
            log.warn({ url: o.url, product: o.product, page: info.pageName }, "Product page does not match the offer");
            return done({ ...o, imageFile: null });
          }
          let imageFile: string | null = null;
          if (info.imageUrl) {
            try {
              imageFile = await storePartImage(info.imageUrl);
            } catch (err) {
              return failed(`image: ${(err as Error).message}`);
            }
          }
          return done({
            ...o,
            // The agent's reference comes from the title; the page's from the shop's data.
            reference: o.reference ?? info.reference,
            brand: o.brand ?? info.brand,
            imageFile,
          });
        } catch (err) {
          return failed((err as Error).message);
        }
      }),
    );
    out.push(...batch);
  }

  // 2. Same reference elsewhere in this lookup (e.g. MISFAT P362 sold by two shops).
  const key = (ref: string | null | undefined) => (ref ? squash(ref) : "");
  const photoByRef = new Map<string, string>();
  for (const o of out) if (o.imageFile && key(o.reference).length >= 3) photoByRef.set(key(o.reference), o.imageFile);
  for (const o of out) {
    if (!o.imageFile && photoByRef.has(key(o.reference))) o.imageFile = photoByRef.get(key(o.reference))!;
  }

  // 3. Shop search by reference (once per offer), also when its page is blocked.
  let searches = 0;
  for (const o of out) {
    if (o.imageFile || o.refSearched || key(o.reference).length < 3 || searches >= MAX_REF_SEARCHES) continue;
    const ref = o.reference!;
    if (photoByRef.has(key(ref))) {
      o.imageFile = photoByRef.get(key(ref))!;
      continue;
    }
    searches++;
    o.refSearched = true;
    try {
      const hit = await searchShops(ref, ref);
      const file = hit ? await storePartImage(hit.imageUrl) : null;
      if (file) {
        o.imageFile = file;
        photoByRef.set(key(ref), file);
        log.info({ ref, found: hit!.productUrl }, "Part photo found by reference");
      }
    } catch (err) {
      log.warn({ ref, err: (err as Error).message }, "Search by reference failed");
    }
  }
  return out;
}

export async function runPriceEnrichment(key: string, log: Logger): Promise<void> {
  const row = await prisma.partPrices.findUnique({ where: { key } });
  if (!row || row.status !== "READY" || !needsEnrichment(row.offers)) return;
  const offers = await enrichOffers(row.offers as unknown as StoredOffer[], log);
  // Only if the row did not change meanwhile (a fresh lookup must not be
  // overwritten). updatedAt is kept: it is the date the prices were read
  // (shown to the owner, and the start of the 30-day cache).
  const { count } = await prisma.partPrices.updateMany({
    where: { key, updatedAt: row.updatedAt, status: "READY" },
    data: { offers: offers as object[], updatedAt: row.updatedAt },
  });
  if (count === 0) return log.info({ key }, "Offers changed during enrichment: skipped");
  log.info({ key, images: offers.filter((o) => o.imageFile).length, refs: offers.filter((o) => o.reference).length }, "Offers enriched");
}

export async function runPriceLookup(data: PriceJobData, finalAttempt: boolean, log: Logger): Promise<void> {
  await prisma.partPrices.update({ where: { key: data.key }, data: { attempts: { increment: 1 } } });
  try {
    const result = await lookupPrices(data.profile as VehicleProfile, data.item as PlanItem);
    const offers = await enrichOffers(result.offers, log);
    await prisma.partPrices.update({
      where: { key: data.key },
      data: {
        status: "READY",
        offers: offers as object[],
        labor: result.labor,
        note: result.note,
        oemRefs: result.oemRefs,
        error: null,
      },
    });
    log.info({ key: data.key, offers: offers.length, images: offers.filter((o) => o.imageFile).length }, "Prices ready");
  } catch (err) {
    if (finalAttempt) {
      await prisma.partPrices.update({
        where: { key: data.key },
        data: { status: "FAILED", error: (err as Error).message.slice(0, 500) },
      });
    }
    throw err;
  }
}
