import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./db.js";

export type EventType =
  | "vehicle_added"
  | "analysis_ready"
  | "mileage_updated"
  | "maintenance_done"
  | "maintenance_undone"
  | "color_changed"
  | "nickname_changed"
  | "info_corrected";

/** Appends one entry to a car's history (never updated or deleted by the app). */
export async function logEvent(vehicleId: string, type: EventType, data?: Prisma.InputJsonValue): Promise<void> {
  await prisma.vehicleEvent.create({ data: { vehicleId, type, data } });
}

/** Same event for every owner's copy of a VIN (e.g. its analysis finished). */
export async function logEventForVin(vin: string, type: EventType, data?: Prisma.InputJsonValue): Promise<void> {
  const vehicles = await prisma.vehicle.findMany({ where: { vin }, select: { id: true } });
  if (vehicles.length === 0) return;
  await prisma.vehicleEvent.createMany({ data: vehicles.map((v) => ({ vehicleId: v.id, type, data })) });
}

interface RecordRow {
  id: string;
  itemId: string;
  itemName: string | null;
  category: string | null;
  doneAtKm: number;
  costTnd: number | null;
  doneAt: Date;
}

interface MileageEvent {
  createdAt: Date;
  data: Prisma.JsonValue;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Report of one car: mileage over time, spending per month and per category,
 * totals. Built from the history only (no AI).
 */
export function buildReport(records: RecordRow[], mileageEvents: MileageEvent[], now: Date = new Date()) {
  // Mileage series: each odometer update, oldest first.
  const mileage = mileageEvents
    .map((e) => ({ date: e.createdAt, km: (e.data as { toKm?: number } | null)?.toKm }))
    .filter((p): p is { date: Date; km: number } => typeof p.km === "number")
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let avgKmPerMonth: number | null = null;
  if (mileage.length >= 2) {
    const first = mileage[0]!;
    const last = mileage[mileage.length - 1]!;
    const days = (last.date.getTime() - first.date.getTime()) / 86_400_000;
    if (days >= 14 && last.km >= first.km) avgKmPerMonth = Math.round(((last.km - first.km) / days) * 30.44);
  }

  // Spending for the last 12 months, zero-filled so the chart has every month.
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  const byMonth = new Map(months.map((m) => [m, 0]));
  const byCategory = new Map<string, { totalTnd: number; count: number }>();
  let spentTnd = 0;
  for (const r of records) {
    const cost = r.costTnd ?? 0;
    spentTnd += cost;
    const m = monthKey(r.doneAt);
    if (byMonth.has(m)) byMonth.set(m, byMonth.get(m)! + cost);
    const cat = r.category ?? "autre";
    const c = byCategory.get(cat) ?? { totalTnd: 0, count: 0 };
    byCategory.set(cat, { totalTnd: c.totalTnd + cost, count: c.count + 1 });
  }

  return {
    totals: {
      spentTnd: Math.round(spentTnd * 1000) / 1000,
      servicesDone: records.length,
      avgKmPerMonth,
      lastMileageKm: mileage.at(-1)?.km ?? null,
    },
    mileage: mileage.map((p) => ({ date: p.date.toISOString(), km: p.km })),
    spendByMonth: months.map((m) => ({ month: m, totalTnd: Math.round(byMonth.get(m)! * 1000) / 1000 })),
    spendByCategory: [...byCategory.entries()]
      .map(([category, v]) => ({ category, totalTnd: Math.round(v.totalTnd * 1000) / 1000, count: v.count }))
      .sort((a, b) => b.totalTnd - a.totalTnd || b.count - a.count),
    records: [...records]
      .sort((a, b) => b.doneAt.getTime() - a.doneAt.getTime())
      .map((r) => ({
        id: r.id,
        itemId: r.itemId,
        itemName: r.itemName,
        category: r.category,
        km: r.doneAtKm,
        costTnd: r.costTnd,
        date: r.doneAt.toISOString(),
      })),
  };
}
