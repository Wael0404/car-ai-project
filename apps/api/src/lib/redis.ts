import { Redis } from "ioredis";
import { config } from "../config.js";

/** Shared connection for rate limiting and login codes. */
export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3 });

/** BullMQ requires maxRetriesPerRequest: null on its connections. */
export function createQueueConnection(): Redis {
  return new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
}
