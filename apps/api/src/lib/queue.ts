import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import { createQueueConnection } from "./redis.js";

/**
 * Stable, collision-free job id part for a long key. (Cutting a base64 key
 * made two items of the same car version share an id, so BullMQ silently
 * dropped the second job.)
 */
const jobKey = (key: string) => createHash("sha256").update(key).digest("base64url");

export const VIN_QUEUE = "vin-research";

/** Make, model and type the owner read on the registration card. */
export interface OwnerHints {
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  /** First registration date as written on the card, e.g. 2020/11/30. */
  firstRegistration?: string | null;
  /** Box P.3 "Énergie" of the card: Essence, Diesel... */
  fuel?: string | null;
}

export interface VinJobData {
  vin: string;
  hints?: OwnerHints;
}

export const vinQueue = new Queue<VinJobData>(VIN_QUEUE, {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: 24 * 3600, count: 10_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/**
 * Enqueue the research of a VIN. The job id is the VIN itself, so the same
 * VIN added by many users at once is researched only once.
 */
export async function enqueueVinResearch(vin: string, hints?: OwnerHints): Promise<void> {
  const jobId = `vin-${vin}`;
  // A finished job keeps its id for a while; clear it so a retry can run.
  const previous = await vinQueue.getJob(jobId);
  if (previous && ((await previous.isFailed()) || (await previous.isCompleted()))) {
    await previous.remove();
  }
  await vinQueue.add("research", { vin, hints }, { jobId });
}

// --- 3D model search (one job per make + model + generation) ---

export const MODEL3D_QUEUE = "model3d-search";

export interface Model3DJobData {
  key: string;
  make: string;
  model: string;
  generation: string | null;
  /** "standard", "Cross", "4x4"... */
  variant: string;
  modelYear: number | null;
  bodyType: string | null;
}

export const model3dQueue = new Queue<Model3DJobData>(MODEL3D_QUEUE, {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: { age: 24 * 3600, count: 10_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function enqueueModel3DSearch(data: Model3DJobData): Promise<void> {
  // BullMQ job ids cannot contain ":"; the key is hashed into a safe id.
  const jobId = `m3d-${jobKey(data.key)}`;
  const previous = await model3dQueue.getJob(jobId);
  if (previous && ((await previous.isFailed()) || (await previous.isCompleted()))) await previous.remove();
  await model3dQueue.add("search", data, { jobId });
}

// --- Maintenance plan (one job per car version + engine) ---

export const MAINTENANCE_QUEUE = "maintenance-plan";

export interface MaintenanceJobData {
  key: string;
  /** The VIN profile the plan is built for (VehicleProfile JSON). */
  profile: unknown;
}

export const maintenanceQueue = new Queue<MaintenanceJobData>(MAINTENANCE_QUEUE, {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: { age: 24 * 3600, count: 10_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function enqueueMaintenancePlan(data: MaintenanceJobData): Promise<void> {
  const jobId = `mp-${jobKey(data.key)}`;
  const previous = await maintenanceQueue.getJob(jobId);
  if (previous && ((await previous.isFailed()) || (await previous.isCompleted()))) await previous.remove();
  await maintenanceQueue.add("plan", data, { jobId });
}

// --- Part prices (one job per maintenance item and car version, on demand) ---

export const PRICE_QUEUE = "part-prices";

export interface PriceJobData {
  key: string;
  profile: unknown;
  item: unknown;
}

export const priceQueue = new Queue<PriceJobData>(PRICE_QUEUE, {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: 24 * 3600, count: 10_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function enqueuePriceLookup(data: PriceJobData): Promise<void> {
  const jobId = `pp-${jobKey(data.key)}`;
  const previous = await priceQueue.getJob(jobId);
  if (previous && ((await previous.isFailed()) || (await previous.isCompleted()))) await previous.remove();
  await priceQueue.add("prices", data, { jobId });
}

// --- Part photos/references (reads shop pages, no AI). Own queue, so a worker
// running older code can never take these jobs for paid price lookups. ---

export const PRICE_ENRICH_QUEUE = "part-price-enrich";

export interface PriceEnrichJobData {
  key: string;
}

export const priceEnrichQueue = new Queue<PriceEnrichJobData>(PRICE_ENRICH_QUEUE, {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 3600, count: 10_000 },
    removeOnFail: { age: 24 * 3600 },
  },
});

/** Photos and references for offers saved before that feature existed (or not read yet). */
export async function enqueuePriceEnrichment(key: string): Promise<void> {
  const jobId = `pe-${jobKey(key)}`;
  const previous = await priceEnrichQueue.getJob(jobId);
  if (previous && ((await previous.isFailed()) || (await previous.isCompleted()))) await previous.remove();
  await priceEnrichQueue.add("enrich", { key }, { jobId });
}
