/**
 * One-off: gives cars created before the history feature a starting history
 * (added, mileage, services done). Safe to run again: skips cars that
 * already have events. Usage: npx tsx scripts/backfill-history.ts
 */
import type { VehicleProfile } from "../src/agent/schema.js";
import type { PlanItem } from "../src/lib/maintenance.js";
import { prisma } from "../src/lib/db.js";
import { maintenanceKey } from "../src/maintenanceJobs.js";

const cars = await prisma.vehicle.findMany({
  include: { spec: true, maintenanceRecords: true, _count: { select: { events: true } } },
});

// Old records were saved without the item name: take it from the car's plan.
let named = 0;
for (const car of cars) {
  const missing = car.maintenanceRecords.filter((r) => r.itemName === null);
  const profile = car.spec.data as unknown as VehicleProfile | null;
  if (missing.length === 0 || !profile) continue;
  const plan = await prisma.maintenancePlan.findUnique({ where: { key: maintenanceKey(profile) } });
  const items = Array.isArray(plan?.items) ? (plan!.items as unknown as PlanItem[]) : [];
  for (const r of missing) {
    const item = items.find((i) => i.id === r.itemId);
    if (!item) continue;
    await prisma.maintenanceRecord.update({ where: { id: r.id }, data: { itemName: item.name, category: item.category } });
    r.itemName = item.name;
    r.category = item.category;
    // Fix the matching history entry too (it showed the technical id).
    const events = await prisma.vehicleEvent.findMany({ where: { vehicleId: car.id, type: "maintenance_done" } });
    for (const e of events) {
      const d = e.data as Record<string, unknown> | null;
      if (d?.recordId === r.id && d.itemName === r.itemId) {
        await prisma.vehicleEvent.update({ where: { id: e.id }, data: { data: { ...d, itemName: item.name, category: item.category } } });
      }
    }
    named++;
  }
}

let added = 0;
for (const car of cars) {
  if (car._count.events > 0) continue;
  const rows: Array<{ vehicleId: string; type: string; data: object; createdAt: Date }> = [
    { vehicleId: car.id, type: "vehicle_added", data: { vin: car.vin, nickname: car.nickname, color: car.color }, createdAt: car.createdAt },
  ];
  if (car.mileageKm !== null) {
    rows.push({
      vehicleId: car.id,
      type: "mileage_updated",
      data: { fromKm: null, toKm: car.mileageKm },
      createdAt: car.mileageUpdatedAt ?? car.updatedAt,
    });
  }
  for (const r of car.maintenanceRecords) {
    rows.push({
      vehicleId: car.id,
      type: "maintenance_done",
      data: { recordId: r.id, itemId: r.itemId, itemName: r.itemName ?? r.itemId, category: r.category, km: r.doneAtKm, costTnd: r.costTnd },
      createdAt: r.doneAt,
    });
  }
  await prisma.vehicleEvent.createMany({ data: rows });
  added += rows.length;
}
console.log(`History backfilled: ${added} events, ${named} record names fixed, ${cars.length} cars checked.`);
await prisma.$disconnect();
process.exit(0); // the job queues imported above keep a Redis connection open
