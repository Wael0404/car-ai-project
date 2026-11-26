import { computeDue, type DueStatus, type PlanItem } from "./maintenance.js";

/**
 * "Carnet de vidange": every oil change of one car (date, km, cost, what was
 * done at the same time) and what is left before the next one. No AI.
 */

export interface OilRecord {
  id: string;
  itemId: string;
  itemName: string | null;
  doneAtKm: number;
  doneAt: Date;
  costTnd: number | null;
  note: string | null;
}

export interface OilLogEntry {
  recordId: string;
  /** YYYY-MM-DD (local) */
  date: string;
  km: number;
  costTnd: number | null;
  note: string | null;
  /** Other services marked done the same day (e.g. "Filtre à air"). */
  alsoDone: string[];
  /** Distance and time since the previous oil change (null for the first). */
  kmSincePrevious: number | null;
  monthsSincePrevious: number | null;
}

export interface OilLog {
  item: { id: string; name: string; intervalKm: number | null; intervalMonths: number | null } | null;
  mileageKm: number | null;
  next: {
    status: DueStatus;
    nextDueKm: number | null;
    nextDueDate: string | null;
    kmLeft: number | null;
    daysLeft: number | null;
    /** Share of the oil's life already used, 0..1+ (by km or time, whichever is further). */
    used: number | null;
    /** True when no oil change was ever recorded: the due point is an estimate. */
    estimated: boolean;
  } | null;
  entries: OilLogEntry[];
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The engine-oil change in a plan ("Vidange huile moteur + filtre à huile"), not gearbox oil. */
export function findOilItem(items: PlanItem[]): PlanItem | null {
  const engine = items.filter((i) => i.category === "moteur");
  return (
    engine.find((i) => i.id === "vidange-huile") ??
    engine.find((i) => i.action === "vidanger") ??
    engine.find((i) => /vidange|huile moteur/i.test(`${i.id} ${i.name}`)) ??
    null
  );
}

export function buildOilLog(
  planItems: PlanItem[],
  records: OilRecord[],
  mileageKm: number | null,
  since: Date | null,
  now: Date = new Date(),
): OilLog {
  const item = findOilItem(planItems);
  if (!item) return { item: null, mileageKm, next: null, entries: [] };

  const names = new Map(planItems.map((i) => [i.id, i.name]));
  const oil = records
    .filter((r) => r.itemId === item.id)
    .sort((a, b) => b.doneAt.getTime() - a.doneAt.getTime() || b.doneAtKm - a.doneAtKm);

  const entries = oil.map((r, i): OilLogEntry => {
    const prev = oil[i + 1];
    const day = ymd(r.doneAt);
    const alsoDone = records
      .filter((o) => o.id !== r.id && o.itemId !== item.id && ymd(o.doneAt) === day)
      .map((o) => o.itemName ?? names.get(o.itemId) ?? o.itemId);
    return {
      recordId: r.id,
      date: day,
      km: r.doneAtKm,
      costTnd: r.costTnd,
      note: r.note,
      alsoDone: [...new Set(alsoDone)],
      kmSincePrevious: prev ? r.doneAtKm - prev.doneAtKm : null,
      monthsSincePrevious: prev
        ? Math.max(0, Math.round((r.doneAt.getTime() - prev.doneAt.getTime()) / (30.44 * 86_400_000)))
        : null,
    };
  });

  let next: OilLog["next"] = null;
  if (mileageKm !== null) {
    const due = computeDue([item], mileageKm, oil, since, now)[0]!;
    const daysLeft = due.nextDueDate
      ? Math.round((new Date(`${due.nextDueDate}T12:00:00`).getTime() - now.getTime()) / 86_400_000)
      : null;
    const last = oil.reduce<OilRecord | undefined>((best, r) => (!best || r.doneAtKm > best.doneAtKm ? r : best), undefined);
    let used: number | null = null;
    if (last) {
      const byKm = item.intervalKm ? (mileageKm - last.doneAtKm) / item.intervalKm : null;
      const byTime = item.intervalMonths
        ? (now.getTime() - last.doneAt.getTime()) / (item.intervalMonths * 30.44 * 86_400_000)
        : null;
      const values = [byKm, byTime].filter((v): v is number => v !== null);
      used = values.length ? Math.max(0, Math.round(Math.max(...values) * 100) / 100) : null;
    }
    next = {
      status: due.status,
      nextDueKm: due.nextDueKm,
      nextDueDate: due.nextDueDate,
      kmLeft: due.kmLeft,
      daysLeft,
      used,
      estimated: !last,
    };
  }

  return {
    item: { id: item.id, name: item.name, intervalKm: item.intervalKm, intervalMonths: item.intervalMonths },
    mileageKm,
    next,
    entries,
  };
}
