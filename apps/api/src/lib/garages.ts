import { redis } from "./redis.js";

/**
 * Garages, parts and tyre shops near a point, from OpenStreetMap (free, no
 * key). Coverage in Tunisia is partial, so the app also offers a Google Maps
 * search button. Results are cached 24 h per ~1 km cell.
 */

export interface Garage {
  id: string;
  name: string;
  kind: "car_repair" | "car_parts" | "tyres";
  lat: number;
  lon: number;
  distanceKm: number;
  phone: string | null;
  address: string | null;
  openingHours: string | null;
}

/** Public Overpass servers (free); the main one is often busy, so try mirrors. */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function overpass(query: string): Promise<unknown> {
  let lastError: unknown;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "CarAI/0.1 (garage finder)" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return await res.json();
      lastError = new Error(`${new URL(url).host} responded ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
const RADIUS_M = 10_000;

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export async function findGarages(lat: number, lon: number): Promise<Garage[]> {
  // ~1.1 km cells: nearby users share the cache.
  const cell = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cacheKey = `garages:${cell}`;
  const cached = await redis.get(cacheKey);
  let elements: Array<{ id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>;

  if (cached) {
    elements = JSON.parse(cached);
  } else {
    const around = `around:${RADIUS_M},${lat.toFixed(4)},${lon.toFixed(4)}`;
    const query = `[out:json][timeout:20];(nwr["shop"="car_repair"](${around});nwr["shop"="car_parts"](${around});nwr["shop"="tyres"](${around}););out center tags 150;`;
    elements = ((await overpass(query)) as { elements?: typeof elements }).elements ?? [];
    await redis.set(cacheKey, JSON.stringify(elements), "EX", 24 * 3600);
  }

  return elements
    .map((e): Garage | null => {
      const t = e.tags ?? {};
      const pLat = e.lat ?? e.center?.lat;
      const pLon = e.lon ?? e.center?.lon;
      if (pLat === undefined || pLon === undefined) return null;
      const kind = t["shop"] as Garage["kind"];
      const address = [t["addr:housenumber"], t["addr:street"], t["addr:city"]].filter(Boolean).join(" ") || null;
      return {
        id: `${e.type}/${e.id}`,
        name: t["name"] ?? t["name:fr"] ?? t["name:ar"] ?? (kind === "tyres" ? "Pneus" : kind === "car_parts" ? "Pièces auto" : "Garage"),
        kind,
        lat: pLat,
        lon: pLon,
        distanceKm: Math.round(distanceKm(lat, lon, pLat, pLon) * 10) / 10,
        phone: t["phone"] ?? t["contact:phone"] ?? null,
        address,
        openingHours: t["opening_hours"] ?? null,
      };
    })
    .filter((g): g is Garage => g !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 30);
}
