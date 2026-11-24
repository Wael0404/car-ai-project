/**
 * Background worker: runs the AI agent for queued VINs.
 * Runs as its own process, so slow research never blocks the API, and can be
 * scaled separately (more worker instances = more VINs researched in parallel).
 */
import { Worker } from "bullmq";
import pino from "pino";
import { AgentRefusalError, researchVehicle } from "./agent/vinAgent.js";
import { config } from "./config.js";
import { prisma } from "./lib/db.js";
import { VIN_QUEUE, type VinJobData } from "./lib/queue.js";
import { createQueueConnection } from "./lib/redis.js";

const log = pino({ name: "vin-worker" });

const worker = new Worker<VinJobData>(
  VIN_QUEUE,
  async (job) => {
    const { vin } = job.data;
    const spec = await prisma.vehicleSpec.findUnique({ where: { vin } });
    if (!spec || spec.status === "READY") return; // already done by another job

    await prisma.vehicleSpec.update({ where: { vin }, data: { attempts: { increment: 1 } } });
    log.info({ vin, attempt: job.attemptsMade + 1 }, "Researching VIN");

    try {
      const profile = await researchVehicle(vin);
      await prisma.vehicleSpec.update({
        where: { vin },
        data: {
          status: "READY",
          make: profile.make,
          model: profile.model,
          modelYear: profile.modelYear,
          bodyType: profile.bodyType,
          data: profile,
          error: null,
        },
      });
      log.info({ vin, make: profile.make, model: profile.model }, "VIN researched");
    } catch (err) {
      const finalAttempt = err instanceof AgentRefusalError || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (finalAttempt) {
        await prisma.vehicleSpec.update({
          where: { vin },
          data: { status: "FAILED", error: (err as Error).message.slice(0, 500) },
        });
      }
      if (err instanceof AgentRefusalError) return; // retrying would not help
      throw err; // BullMQ retries with exponential backoff
    }
  },
  { connection: createQueueConnection(), concurrency: config.AGENT_CONCURRENCY },
);

worker.on("failed", (job, err) => log.error({ vin: job?.data.vin, err: err.message }, "Job failed"));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    log.info("Stopping worker (waiting for running jobs)");
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

log.info({ concurrency: config.AGENT_CONCURRENCY }, "VIN worker started");
