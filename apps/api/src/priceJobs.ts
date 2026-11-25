import type { Logger } from "pino";
import { lookupPrices } from "./agent/priceAgent.js";
import type { VehicleProfile } from "./agent/schema.js";
import { prisma } from "./lib/db.js";
import type { PlanItem } from "./lib/maintenance.js";
import { enqueuePriceLookup, type PriceJobData } from "./lib/queue.js";

/** Prices change: a lookup is reused for a week, then refreshed on the next view. */
export const PRICE_TTL_MS = 7 * 24 * 3600 * 1000;

/**
 * Returns the cached prices, or queues a lookup (only when an owner opens the
 * item, so nothing is spent on items nobody looks at).
 */
export async function getOrQueuePrices(key: string, profile: VehicleProfile, item: PlanItem) {
  const row = await prisma.partPrices.findUnique({ where: { key } });
  const fresh = row && Date.now() - row.updatedAt.getTime() < PRICE_TTL_MS;
  if (row && (row.status === "PENDING" || (fresh && row.status !== "FAILED"))) return row;
  // Missing, stale, or failed more than a day ago: (re)queue.
  if (row?.status === "FAILED" && Date.now() - row.updatedAt.getTime() < 24 * 3600 * 1000) return row;

  const saved = await prisma.partPrices.upsert({
    where: { key },
    update: { status: "PENDING", error: null },
    create: { key },
  });
  await enqueuePriceLookup({ key, profile, item });
  return saved;
}

export async function runPriceLookup(data: PriceJobData, finalAttempt: boolean, log: Logger): Promise<void> {
  await prisma.partPrices.update({ where: { key: data.key }, data: { attempts: { increment: 1 } } });
  try {
    const result = await lookupPrices(data.profile as VehicleProfile, data.item as PlanItem);
    await prisma.partPrices.update({
      where: { key: data.key },
      data: { status: "READY", offers: result.offers, labor: result.labor, note: result.note, error: null },
    });
    log.info({ key: data.key, offers: result.offers.length }, "Prices ready");
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
