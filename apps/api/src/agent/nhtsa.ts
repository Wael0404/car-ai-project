/**
 * Free VIN decoder from the US NHTSA (vPIC). Very complete for vehicles sold
 * in North America, partial for European and Asian VINs (often only the
 * make and the plant), which is why the AI agent completes it.
 * https://vpic.nhtsa.dot.gov/api/
 */

const ENDPOINT = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended";

export type NhtsaDecode = Record<string, string>;

export async function decodeVinNhtsa(vin: string, signal?: AbortSignal): Promise<NhtsaDecode> {
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(vin)}?format=json`, {
    signal: signal ?? AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`NHTSA vPIC responded ${res.status}`);

  const body = (await res.json()) as { Results?: Array<Record<string, unknown>> };
  const row = body.Results?.[0] ?? {};

  // Keep only the fields that have a value, to keep the prompt short.
  const decoded: NhtsaDecode = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" && value.trim() !== "" && value !== "Not Applicable") {
      decoded[key] = value.trim();
    }
  }
  return decoded;
}
