/**
 * Makes and commercial types (as written on a Tunisian carte grise: capitals)
 * offered in the app's drop-down lists. A starting list of what is common in
 * Tunisia, completed with the cars our users already registered. The owner
 * can always type a value that is not listed.
 */
const BASE: Record<string, string[]> = {
  "ALFA ROMEO": ["GIULIA", "GIULIETTA", "MITO", "STELVIO", "TONALE"],
  AUDI: ["A1", "A3", "A4", "A5", "A6", "Q2", "Q3", "Q5", "Q7"],
  BMW: ["SERIE 1", "SERIE 2", "SERIE 3", "SERIE 5", "X1", "X3", "X5", "X6"],
  BYD: ["ATTO 3", "DOLPHIN", "F3", "SEAL"],
  CHERY: ["ARRIZO 5", "QQ", "TIGGO 2", "TIGGO 3", "TIGGO 4", "TIGGO 7", "TIGGO 8"],
  CITROEN: ["BERLINGO", "C-ELYSEE", "C1", "C3", "C3 AIRCROSS", "C4", "C4 CACTUS", "C5", "C5 AIRCROSS", "JUMPER", "JUMPY", "NEMO", "SAXO", "XSARA"],
  CUPRA: ["BORN", "FORMENTOR", "LEON"],
  DACIA: ["DOKKER", "DUSTER", "JOGGER", "LODGY", "LOGAN", "SANDERO", "SPRING"],
  DS: ["DS3", "DS4", "DS7"],
  FIAT: ["500", "500L", "500X", "ALBEA", "BRAVO", "DOBLO", "DUCATO", "FIORINO", "GRANDE PUNTO", "LINEA", "PALIO", "PANDA", "PUNTO", "QUBO", "SIENA", "STRADA", "TIPO", "UNO"],
  FORD: ["ECOSPORT", "FIESTA", "FOCUS", "FUSION", "KUGA", "MONDEO", "PUMA", "RANGER", "TOURNEO", "TRANSIT"],
  GEELY: ["AZKARRA", "COOLRAY", "EMGRAND", "GX3", "OKAVANGO"],
  "GREAT WALL": ["POER", "STEED", "WINGLE"],
  HAVAL: ["H2", "H6", "JOLION"],
  HONDA: ["ACCORD", "CIVIC", "CR-V", "HR-V", "JAZZ"],
  HYUNDAI: ["ACCENT", "BAYON", "CRETA", "ELANTRA", "GRAND I10", "H1", "H100", "I10", "I20", "I30", "KONA", "SANTA FE", "TUCSON", "VENUE"],
  ISUZU: ["D-MAX", "NKR", "NMR", "NPR"],
  JEEP: ["CHEROKEE", "COMPASS", "GRAND CHEROKEE", "RENEGADE", "WRANGLER"],
  KIA: ["CARNIVAL", "CERATO", "K2700", "PEGAS", "PICANTO", "RIO", "SELTOS", "SONET", "SORENTO", "SPORTAGE", "STONIC"],
  "LAND ROVER": ["DEFENDER", "DISCOVERY", "RANGE ROVER", "RANGE ROVER EVOQUE"],
  MAHINDRA: ["KUV100", "PIK UP", "SCORPIO", "XUV300", "XUV500"],
  MAZDA: ["2", "3", "6", "BT-50", "CX-3", "CX-5"],
  "MERCEDES-BENZ": ["CITAN", "CLA", "CLASSE A", "CLASSE B", "CLASSE C", "CLASSE E", "CLASSE S", "GLA", "GLC", "GLE", "SPRINTER", "VITO"],
  MG: ["HS", "MG3", "MG4", "MG5", "RX5", "ZS"],
  MITSUBISHI: ["ASX", "ATTRAGE", "L200", "LANCER", "OUTLANDER", "PAJERO", "SPACE STAR"],
  NISSAN: ["JUKE", "MICRA", "NAVARA", "NOTE", "PATROL", "QASHQAI", "SUNNY", "X-TRAIL"],
  OPEL: ["ASTRA", "COMBO", "CORSA", "CROSSLAND", "GRANDLAND", "INSIGNIA", "MOKKA", "MOVANO", "VIVARO"],
  PEUGEOT: ["106", "107", "108", "206", "207", "208", "2008", "301", "306", "307", "308", "3008", "405", "406", "407", "508", "5008", "BIPPER", "BOXER", "EXPERT", "LANDTREK", "PARTNER", "RIFTER"],
  RENAULT: ["ARKANA", "AUSTRAL", "CAPTUR", "CLIO", "DUSTER", "EXPRESS", "FLUENCE", "KADJAR", "KANGOO", "LAGUNA", "LOGAN", "MASTER", "MEGANE", "SANDERO", "SCENIC", "SYMBOL", "TRAFIC", "TWINGO"],
  SEAT: ["ARONA", "ATECA", "CORDOBA", "IBIZA", "LEON", "TOLEDO"],
  SKODA: ["FABIA", "KAMIQ", "KAROQ", "KODIAQ", "OCTAVIA", "RAPID", "SCALA", "SUPERB"],
  SUZUKI: ["ALTO", "BALENO", "CELERIO", "CIAZ", "DZIRE", "ERTIGA", "GRAND VITARA", "JIMNY", "S-PRESSO", "SWIFT", "VITARA"],
  TOYOTA: ["AURIS", "AYGO", "C-HR", "COROLLA", "FORTUNER", "HILUX", "LAND CRUISER", "PRADO", "RAV4", "YARIS"],
  VOLKSWAGEN: ["AMAROK", "BORA", "CADDY", "GOLF", "JETTA", "PASSAT", "POLO", "T-CROSS", "T-ROC", "TIGUAN", "TOUAREG", "TRANSPORTER", "VIRTUS"],
};

/** "Citroën" / " fiat " -> "CITROEN" / "FIAT" (carte grise style, no accents). */
export function normalizeName(value: string | null | undefined): string | null {
  const v = value
    ?.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return v && v.length <= 60 ? v : null;
}

/** Same make under several spellings. */
const ALIASES: Record<string, string> = { MERCEDES: "MERCEDES-BENZ", VW: "VOLKSWAGEN", "LAND-ROVER": "LAND ROVER", ALFA: "ALFA ROMEO" };

export interface CatalogMake {
  name: string;
  models: string[];
}

/** Base list + makes/models seen in the database, sorted, without duplicates. */
export function buildCatalog(seen: Array<{ make: string | null | undefined; model: string | null | undefined }>): CatalogMake[] {
  const map = new Map<string, Set<string>>(Object.entries(BASE).map(([make, models]) => [make, new Set(models)]));
  for (const s of seen) {
    let make = normalizeName(s.make);
    if (!make || make.length > 40) continue;
    make = ALIASES[make] ?? make;
    const models = map.get(make) ?? new Set<string>();
    const model = normalizeName(s.model);
    if (model) models.add(model);
    map.set(make, models);
  }
  const byName = (a: string, b: string) => a.localeCompare(b, "fr", { numeric: true });
  return [...map.entries()]
    .map(([name, models]) => ({ name, models: [...models].sort(byName) }))
    .sort((a, b) => byName(a.name, b.name));
}
