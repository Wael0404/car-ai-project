import { Queue } from "bullmq";
import { createQueueConnection } from "./redis.js";

export const VIN_QUEUE = "vin-research";

/** Make, model and type the owner read on the registration card. */
export interface OwnerHints {
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  /** First registration date as written on the card, e.g. 2020/11/30. */
  firstRegistration?: string | null;
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
