/** Quick client-side check; the API does the full validation (check digit...). */
export function normalizeVin(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function vinError(raw: string): string | null {
  const vin = normalizeVin(raw);
  if (vin.length === 0) return null;
  if (/[IOQ]/.test(vin)) return "Le VIN ne contient jamais les lettres I, O ou Q.";
  if (!/^[A-Z0-9]*$/.test(vin)) return "Uniquement des lettres et des chiffres.";
  if (vin.length !== 17) return `${vin.length}/17 caractères`;
  return null;
}
