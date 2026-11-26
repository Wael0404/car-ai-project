/**
 * Petrol or diesel: decides which parts and services apply to a car.
 * The owner's carte grise (box P.3 "Énergie": ES, GO, EH, EL, GP...) is the
 * reference; otherwise what the VIN research found.
 */

export type Fuel = "Essence" | "Diesel" | "Hybride" | "Électrique" | "GPL";
export const FUELS: Fuel[] = ["Essence", "Diesel", "Hybride", "Électrique", "GPL"];

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** "GO", "Gazole", "diesel", "1.5 dCi" -> "Diesel"; "ES", "essence", "TwinAir" -> "Essence"... */
export function normalizeFuel(value: string | null | undefined): Fuel | null {
  if (!value) return null;
  const v = ` ${fold(value).replace(/[^a-z0-9.]+/g, " ")} `;
  // Hybrids and gas first: "essence hybride" is a hybrid, "essence/GPL" runs on GPL.
  if (/ (hybride?|hybrid|hev|phev|eh|ee|eh) /.test(v) || /hybrid/.test(v)) return "Hybride";
  if (/ (electrique|electric|ev|el|bev) /.test(v)) return "Électrique";
  if (/ (gpl|lpg|gp|eg|gnv|cng) /.test(v)) return "GPL";
  if (/ (diesel|gazole|gasoil|go|gaz oil|dci|tdi|hdi|crdi|cdti|multijet|jtd|jtdm|tdci|d 4d|bluehdi|dtec|dti) /.test(v)) return "Diesel";
  if (/ (essence|gasoline|petrol|es|sp95|sp98|tsi|tfsi|tce|vti|thp|puretech|twinair|fire|ecoboost|mpi|gdi|tgdi|vvt|vvti) /.test(v)) return "Essence";
  return null;
}

/** Words that tie a part or a service to a diesel engine. */
const DIESEL_ONLY =
  /\b(diesel|gazole|gasoil|dci|tdi|hdi|crdi|cdti|multijet|jtdm?|tdci|d-4d|bluehdi|dtec|pr[ée]chauffage|bougies? de pr[ée]chauffage|adblue|fap|filtre [àa] particules|injecteurs? diesel)\b/i;
/** Words that tie a part or a service to a petrol engine. */
const PETROL_ONLY =
  /\b(essence|tce|tsi|tfsi|vti|thp|puretech|twinair|ecoboost|bougies? d'allumage|bougie d'allumage|bougies? \(essence\)|allumage|bobines? d'allumage)\b/i;

/**
 * True when this text (offer title, plan item) is clearly for the other
 * fuel: "ASHIKA 20-01-134, pour 1.5 dCi" on a petrol car, "Bougies
 * (essence)" on a diesel. Unknown fuel or neutral text: no conflict.
 */
export function conflictsWithFuel(text: string, fuel: Fuel | null): boolean {
  if (!fuel || !text) return false;
  const diesel = DIESEL_ONLY.test(text);
  const petrol = PETROL_ONLY.test(text);
  if (diesel && petrol) return false; // "essence ou diesel": fits both
  if (fuel === "Diesel") return petrol;
  if (fuel === "Essence" || fuel === "GPL") return diesel;
  if (fuel === "Hybride") return diesel; // petrol hybrids (the common case in Tunisia)
  // Electric cars have neither oil changes nor plugs: anything engine-specific conflicts.
  return diesel || petrol;
}

/**
 * The profile with the fuel the owner read on the card (box P.3), which is
 * authoritative over what the research found. Unchanged when not given.
 */
export function withDeclaredFuel<P extends { engine?: { fuelType?: string | null } | null }>(profile: P, declared: string | null | undefined): P {
  const fuel = normalizeFuel(declared);
  if (!fuel) return profile;
  return { ...profile, engine: { ...(profile.engine ?? {}), fuelType: fuel } } as P;
}

/** The car's fuel: the owner's card first, then the research. */
export function vehicleFuel(declaredFuel: string | null | undefined, profileFuel: string | null | undefined): Fuel | null {
  return normalizeFuel(declaredFuel) ?? normalizeFuel(profileFuel);
}

/** Spark plugs are petrol only, even when the name does not say "essence". */
export function planItemFitsFuel(item: { id: string; name: string; note?: string }, fuel: Fuel | null): boolean {
  if (!fuel) return true;
  const text = `${item.name} ${item.note ?? ""}`;
  const sparkPlugs = /bougie/i.test(`${item.id} ${item.name}`) && !/pr[ée]chauffage/i.test(text);
  if (fuel === "Diesel" && sparkPlugs) return false;
  return !conflictsWithFuel(text, fuel);
}
