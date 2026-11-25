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
