import type { Logger } from "pino";
import { generateMaintenancePlan } from "./agent/maintenanceAgent.js";
import type { VehicleProfile } from "./agent/schema.js";
import { prisma } from "./lib/db.js";
import { enqueueMaintenancePlan, type MaintenanceJobData } from "./lib/queue.js";

const clean = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Same version + same engine = same maintenance plan, shared by all owners. */
export function maintenanceKey(p: Pick<VehicleProfile, "make" | "model" | "generation" | "bodyVariant" | "engine">): string | null {
  if (!p.make || !p.model) return null;
  return [p.make, p.model, p.generation, p.bodyVariant || "standard", p.engine?.description, p.engine?.fuelType]
    .map(clean)
    .join("|")
    .slice(0, 250);
}

/** Called when a VIN profile is ready: queues its maintenance plan once. */
export async function ensureMaintenancePlan(profile: VehicleProfile, log: Logger): Promise<void> {
  const key = maintenanceKey(profile);
  if (!key) return;
  const existing = await prisma.maintenancePlan.findUnique({ where: { key } });
  if (existing && existing.status !== "FAILED") return;
  await prisma.maintenancePlan.upsert({ where: { key }, update: { status: "PENDING", error: null }, create: { key } });
  await enqueueMaintenancePlan({ key, profile });
  log.info({ key }, "Maintenance plan queued");
}

export async function runMaintenancePlan(data: MaintenanceJobData, finalAttempt: boolean, log: Logger): Promise<void> {
  await prisma.maintenancePlan.update({ where: { key: data.key }, data: { attempts: { increment: 1 } } });
  try {
    const plan = await generateMaintenancePlan(data.profile as VehicleProfile);
    await prisma.maintenancePlan.update({
      where: { key: data.key },
      data: { status: "READY", items: plan.items, notes: plan.generalNotes, confidence: plan.confidence, error: null },
    });
    log.info({ key: data.key, items: plan.items.length }, "Maintenance plan ready");
  } catch (err) {
    if (finalAttempt) {
      await prisma.maintenancePlan.update({
        where: { key: data.key },
        data: { status: "FAILED", error: (err as Error).message.slice(0, 500) },
      });
    }
    throw err;
  }
}
