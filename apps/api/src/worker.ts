/**
 * Background worker: runs the AI agent for queued VINs.
 * Runs as its own process, so slow research never blocks the API, and can be
 * scaled separately (more worker instances = more VINs researched in parallel).
 */
import { Worker } from "bullmq";
import pino from "pino";
import type { VehicleProfile } from "./agent/schema.js";
import { AgentRefusalError, researchVehicle } from "./agent/vinAgent.js";
import { config } from "./config.js";
import { prisma } from "./lib/db.js";
import {
  MAINTENANCE_QUEUE,
  MODEL3D_QUEUE,
  VIN_QUEUE,
  type MaintenanceJobData,
  type Model3DJobData,
  type VinJobData,
} from "./lib/queue.js";
import { ensureModel3D, runModel3DSearch } from "./model3dJobs.js";
import { ensureMaintenancePlan, runMaintenancePlan } from "./maintenanceJobs.js";
import { findReusableProfile } from "./lib/specReuse.js";
import { createQueueConnection } from "./lib/redis.js";

const log = pino({ name: "vin-worker" });

const worker = new Worker<VinJobData>(
  VIN_QUEUE,
  async (job) => {
    const { vin, hints } = job.data;
    const spec = await prisma.vehicleSpec.findUnique({ where: { vin } });
    if (!spec || spec.status === "READY") return; // already done by another job

    // Free: same make + type constructeur + year already researched for another owner.
    const reused = await findReusableProfile(vin, hints);
    if (reused) {
      const p = reused as unknown as VehicleProfile;
      await prisma.vehicleSpec.update({
        where: { vin },
        data: { status: "READY", make: p.make, model: p.model, modelYear: p.modelYear, bodyType: p.bodyType, data: reused, error: null },
      });
      log.info({ vin, make: p.make, model: p.model }, "Profile reused from same type code (no AI cost)");
      await ensureModel3D(p, log);
      await ensureMaintenancePlan(p, log);
      return;
    }

    await prisma.vehicleSpec.update({ where: { vin }, data: { attempts: { increment: 1 } } });
    log.info({ vin, attempt: job.attemptsMade + 1 }, "Researching VIN");

    try {
      const profile = await researchVehicle(vin, hints);
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
      await ensureModel3D(profile, log);
      await ensureMaintenancePlan(profile, log);
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

/** Second queue: the 3D model agent (one search per make/model/generation). */
/** Third queue: maintenance plan per car version (one cheap AI run each). */
const maintenanceWorker = new Worker<MaintenanceJobData>(
  MAINTENANCE_QUEUE,
  async (job) => {
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    log.info({ key: job.data.key }, "Building maintenance plan");
    await runMaintenancePlan(job.data, finalAttempt, log);
  },
  { connection: createQueueConnection(), concurrency: 2 },
);
maintenanceWorker.on("failed", (job, err) => log.error({ key: job?.data.key, err: err.message }, "Maintenance job failed"));

const model3dWorker = new Worker<Model3DJobData>(
  MODEL3D_QUEUE,
  async (job) => {
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    log.info({ key: job.data.key }, "Searching 3D model");
    await runModel3DSearch(job.data, finalAttempt, log);
  },
  { connection: createQueueConnection(), concurrency: 2 },
);
model3dWorker.on("failed", (job, err) => log.error({ key: job?.data.key, err: err.message }, "3D model job failed"));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    log.info("Stopping worker (waiting for running jobs)");
    await Promise.all([worker.close(), model3dWorker.close(), maintenanceWorker.close()]);
    await prisma.$disconnect();
    process.exit(0);
  });
}

log.info({ concurrency: config.AGENT_CONCURRENCY }, "VIN worker started");

// Cars researched before the 3D agent existed: queue their 3D model search.
const ready = await prisma.vehicleSpec.findMany({ where: { status: "READY" }, select: { data: true } });
for (const spec of ready) {
  if (spec.data) await ensureModel3D(spec.data as unknown as VehicleProfile, log).catch(() => {});
  if (spec.data) await ensureMaintenancePlan(spec.data as unknown as VehicleProfile, log).catch(() => {});
}
