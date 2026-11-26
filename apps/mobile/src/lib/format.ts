import { t, tp, type TKey } from "@/i18n";
import type { Vehicle } from "./types";

/**
 * Numbers, units and dates in the owner's language (French or Arabic).
 * Numbers keep Western digits and French grouping ("85 000"), as usual in
 * Tunisia in both languages.
 */

export function vehicleTitle(v: Vehicle): string {
  if (v.nickname) return v.nickname;
  const p = v.profile;
  if (p?.make) return [p.make, p.model].filter(Boolean).join(" ");
  return t("common.myCar");
}

const num = (n: number, max = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: max });

export const km = (n: number) => t("unit.km", { n: num(n) });

export const tnd = (n: number) => t("unit.tnd", { n: num(n, 3) });

/** "2026-01-31" -> "31/01/2026" (same in both languages). */
export const dateFr = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Month name (0 = January) in the current language ("janvier" / "جانفي"). */
export const monthName = (i: number) => t(`months.${i}` as TKey);

/** @deprecated use monthName(i): kept for older code, always French. */
export const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** "2026-01-31" (or an ISO date-time) -> "31 janvier 2026" / "31 جانفي 2026". */
export const dateLongFr = (iso: string) => {
  const d = iso.length > 10 ? new Date(iso) : new Date(`${iso}T12:00:00`);
  const day = d.getDate() === 1 ? t("date.first") : String(d.getDate());
  return t("date.long", { day, month: monthName(d.getMonth()), year: d.getFullYear() });
};

/** Interval: 12 -> "chaque année", 24 -> "tous les 2 ans", 6 -> "tous les 6 mois". */
export const everyMonthsFr = (n: number) =>
  n === 12 ? t("every.year") : n % 12 === 0 ? t("every.years", { n: n / 12 }) : t("every.months", { n });

/** 1 -> "1 mois", 14 -> "1 an et 2 mois" (and the Arabic forms). */
export const monthsFr = (n: number) => {
  const y = Math.floor(n / 12);
  const m = n % 12;
  const years = y === 0 ? "" : tp("duration.year", y);
  const months = m === 0 ? "" : tp("duration.month", m);
  if (years && months) return t("duration.and", { a: years, b: months });
  return years || months || t("duration.lessThanMonth");
};

/**
 * "31/01/2026" -> { day: "2026-01-31" } for a real day, not in the future,
 * after 1980; otherwise the reason in the owner's language.
 */
export function checkDayFr(input: string, now: Date = new Date()): { day: string } | { error: string } {
  const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { error: t("dayInput.format") };
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d, 12);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return { error: t("dayInput.invalid") };
  }
  if (y < 1980) return { error: t("dayInput.tooOld") };
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (date > endOfToday) return { error: t("dayInput.future") };
  return { day: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

export function parseDayFr(input: string, now: Date = new Date()): string | null {
  const r = checkDayFr(input, now);
  return "day" in r ? r.day : null;
}

/**
 * Digits typed -> "JJ/MM/AAAA" as the owner types. Once the slashes are
 * there, the owner's segments are kept, so fixing one digit in the middle
 * does not shift the rest of the date.
 */
export const maskDayFr = (raw: string) => {
  if (raw.includes("/")) return raw.replace(/[^\d/]/g, "").slice(0, 10);
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
};
