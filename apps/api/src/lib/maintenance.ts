/**
 * Maintenance due dates, computed without any AI call: the shared plan of the
 * car version + the owner's mileage + what the owner marked as done.
 */

export interface PlanItem {
  id: string;
  name: string;
  category: string;
  action: string;
  intervalKm: number | null;
  intervalMonths: number | null;
  note: string;
}

export interface DoneRecord {
  itemId: string;
  doneAtKm: number;
  doneAt: Date;
}

export type DueStatus = "overdue" | "soon" | "ok";

export interface DueItem extends PlanItem {
  status: DueStatus;
  /** Km at which it is next due (null if only time-based). */
  nextDueKm: number | null;
  /** Date at which it is next due (null if only km-based or start unknown). */
  nextDueDate: string | null;
  /** Km left before it is due (negative when overdue). */
  kmLeft: number | null;
  lastDoneKm: number | null;
  lastDoneAt: string | null;
  /** Never marked done although its first interval is already passed. */
  unknownHistory: boolean;
}

/** Items whose skipped replacement can destroy the engine: never assumed done. */
const CRITICAL = new Set(["distribution"]);

/** Warn this many km / days before the due point. */
export const SOON_KM = 1500;
export const SOON_DAYS = 30;

/** YYYY-MM-DD in local time (toISOString would shift the day across time zones). */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addMonths = (d: Date, months: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
};

/**
 * @param mileageKm current odometer (km)
 * @param since date the car started its life (first registration) — used when
 *   an item was never marked done; null if unknown
 */
export function computeDue(
  items: PlanItem[],
  mileageKm: number,
  records: DoneRecord[],
  since: Date | null,
  now: Date = new Date(),
): DueItem[] {
  const lastById = new Map<string, DoneRecord>();
  for (const r of records) {
    const prev = lastById.get(r.itemId);
    if (!prev || r.doneAtKm > prev.doneAtKm) lastById.set(r.itemId, r);
  }

  const result = items.map((item): DueItem => {
    const last = lastById.get(item.id);
    const fromKm = last?.doneAtKm ?? 0;
    const fromDate = last?.doneAt ?? since;

    let nextDueKm: number | null = null;
    if (item.intervalKm && item.intervalKm > 0) {
      // Never done: the next multiple of the interval after 0 that is not yet
      // passed is still "overdue" only if mileage already went beyond it.
      nextDueKm = fromKm + item.intervalKm;
      if (!last) {
        // Assume the services before were done on time; the one in progress is due.
        nextDueKm = Math.max(item.intervalKm, Math.ceil(mileageKm / item.intervalKm) * item.intervalKm);
      }
    }
    let nextDueDate: Date | null = null;
    if (item.intervalMonths && item.intervalMonths > 0 && fromDate) {
      nextDueDate = addMonths(fromDate, item.intervalMonths);
      if (!last) while (nextDueDate < now && since) nextDueDate = addMonths(nextDueDate, item.intervalMonths);
    }

    const kmLeft = nextDueKm === null ? null : nextDueKm - mileageKm;
    const daysLeft = nextDueDate === null ? null : (nextDueDate.getTime() - now.getTime()) / 86_400_000;

    // Never marked done although the first interval is passed: for most items we
    // assume past services were done, but a timing belt/chain we cannot assume.
    const unknownHistory = !last && item.intervalKm !== null && mileageKm >= item.intervalKm;

    let status: DueStatus = "ok";
    if ((kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft <= 0 && last)) status = "overdue";
    else if (unknownHistory && CRITICAL.has(item.category)) status = "overdue";
    else if ((kmLeft !== null && kmLeft <= SOON_KM) || (daysLeft !== null && daysLeft <= SOON_DAYS)) status = "soon";

    return {
      ...item,
      status,
      nextDueKm,
      nextDueDate: nextDueDate ? ymd(nextDueDate) : null,
      kmLeft,
      lastDoneKm: last?.doneAtKm ?? null,
      lastDoneAt: last ? ymd(last.doneAt) : null,
      unknownHistory,
    };
  });

  const rank: Record<DueStatus, number> = { overdue: 0, soon: 1, ok: 2 };
  return result.sort((a, b) => rank[a.status] - rank[b.status] || (a.kmLeft ?? Infinity) - (b.kmLeft ?? Infinity));
}

/** Parses "2020/11/30", "30/11/2020" or "2020-11-30". */
export function parseRegistrationDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const v = value.trim();
  let m = v.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

/** "2026-03-14" -> that day at noon (local), or null if invalid, in the future or before 1980. */
export function parseServiceDate(value: string, now: Date = new Date()): Date | null {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d, 12);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (date > endOfToday || y < 1980) return null;
  return date;
}
