import type { Vehicle } from "./types";

export function vehicleTitle(v: Vehicle): string {
  if (v.nickname) return v.nickname;
  const p = v.profile;
  if (p?.make) return [p.make, p.model].filter(Boolean).join(" ");
  return "Ma voiture";
}

export const km = (n: number) => `${n.toLocaleString("fr-FR")} km`;

export const tnd = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} DT`;

/** "2026-01-31" -> "31/01/2026" */
export const dateFr = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** "2026-01-31" (or an ISO date-time) -> "31 janvier 2026" */
export const dateLongFr = (iso: string) => {
  const d = iso.length > 10 ? new Date(iso) : new Date(`${iso}T12:00:00`);
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
};

/** Interval in plain French: 12 -> "chaque année", 24 -> "tous les 2 ans", 6 -> "tous les 6 mois". */
export const everyMonthsFr = (n: number) =>
  n === 12 ? "chaque année" : n % 12 === 0 ? `tous les ${n / 12} ans` : `tous les ${n} mois`;

/** 1 -> "1 mois", 14 -> "1 an et 2 mois" */
export const monthsFr = (n: number) => {
  const y = Math.floor(n / 12);
  const m = n % 12;
  const years = y === 0 ? "" : y === 1 ? "1 an" : `${y} ans`;
  const months = m === 0 ? "" : `${m} mois`;
  return [years, months].filter(Boolean).join(" et ") || "moins d'un mois";
};

/**
 * "31/01/2026" -> { day: "2026-01-31" } for a real day, not in the future,
 * after 1980; otherwise the reason in plain French.
 */
export function checkDayFr(input: string, now: Date = new Date()): { day: string } | { error: string } {
  const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { error: "Écrivez la date au format JJ/MM/AAAA (ex. 14/03/2026)" };
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d, 12);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return { error: "Cette date n'existe pas (ex. 14/03/2026)" };
  }
  if (y < 1980) return { error: "Année trop ancienne" };
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (date > endOfToday) return { error: "La date ne peut pas être dans le futur" };
  return { day: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

export function parseDayFr(input: string, now: Date = new Date()): string | null {
  const r = checkDayFr(input, now);
  return "day" in r ? r.day : null;
}

/** Digits typed -> "JJ/MM/AAAA" as the owner types. */
export const maskDayFr = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
};
