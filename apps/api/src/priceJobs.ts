import type { Logger } from "pino";
import { lookupPrices } from "./agent/priceAgent.js";
import type { VehicleProfile } from "./agent/schema.js";
import { prisma } from "./lib/db.js";
import type { PlanItem } from "./lib/maintenance.js";
import { storePartImage } from "./lib/partImages.js";
import { fetchProductInfo, isAllowedShopUrl, pageContradicts } from "./lib/productPage.js";
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
  /** Failed attempts to read the page (it is given up after MAX_ENRICH_TRIES). */
  enrichTries?: number;
}

const MAX_ENRICH_TRIES = 2;

export const needsEnrichment = (offers: unknown): boolean =>
  Array.isArray(offers) && offers.some((o) => !(o as StoredOffer).enriched);

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

/** Reads each product page (3 at a time) for the part photo and reference. */
export async function enrichOffers(offers: StoredOffer[], log: Logger): Promise<StoredOffer[]> {
  const out: StoredOffer[] = [];
  for (let i = 0; i < offers.length; i += 3) {
    const batch = await Promise.all(
      offers.slice(i, i + 3).map(async (o): Promise<StoredOffer> => {
        if (o.enriched) return o;
        if (!isAllowedShopUrl(o.url)) return { ...o, enriched: true };
        // A temporary failure (timeout, 429/503, disk) is retried once on a later view.
        const failed = (why: string): StoredOffer => {
          const tries = (o.enrichTries ?? 0) + 1;
          log.warn({ url: o.url, why, tries }, "Product page not read");
          return { ...o, enrichTries: tries, enriched: tries >= MAX_ENRICH_TRIES };
        };
        try {
          const info = await fetchProductInfo(o.url, o.product);
          if (!info) return failed("page unavailable");
          if (pageContradicts(o.product, o.reference, info)) {
            // The link shows another product: keep the agent's data, no photo.
            log.warn({ url: o.url, product: o.product, page: info.pageName }, "Product page does not match the offer");
            return { ...o, imageFile: null, enriched: true };
          }
          let imageFile: string | null = null;
          if (info.imageUrl) {
            try {
              imageFile = await storePartImage(info.imageUrl);
            } catch (err) {
              return failed(`image: ${(err as Error).message}`);
            }
          }
          return {
            ...o,
            // The agent's reference comes from the title; the page's from the shop's data.
            reference: o.reference ?? info.reference,
            brand: o.brand ?? info.brand,
            imageFile,
            enriched: true,
          };
        } catch (err) {
          return failed((err as Error).message);
        }
      }),
    );
    out.push(...batch);
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
