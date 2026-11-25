/**
 * Free photos of cars from Wikimedia Commons (no API key needed).
 * Only freely licensed photos are kept: public domain, CC0, CC BY, CC BY-SA
 * (no NonCommercial / NoDerivatives), since a 3D model made from the photo is
 * a derivative work shown in the app.
 */

export interface CarPhoto {
  title: string;
  pageUrl: string;
  /** ~1000 px image used for the vision check and the 3D generation. */
  imageUrl: string;
  author: string;
  license: string;
}

const API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia asks automated clients to identify themselves.
const USER_AGENT = "CarAI/0.1 (3D model generation from free photos)";

const FREE_LICENSE = /public domain|^pd|cc0|cc[ -]by(?:[ -]sa)?(?:[ -]\d|$| )/i;
const NOT_FREE = /\bnc\b|non-?commercial|\bnd\b|no-?deriv/i;

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

export async function searchCarPhotos(query: string, limit = 30): Promise<CarPhoto[]> {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1000",
  }).toString();

  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Wikimedia search responded ${res.status}`);
  const body = (await res.json()) as {
    query?: { pages?: Record<string, { title: string; imageinfo?: Array<Record<string, unknown>> }> };
  };

  const photos: CarPhoto[] = [];
  for (const page of Object.values(body.query?.pages ?? {})) {
    const info = page.imageinfo?.[0] as
      | { thumburl?: string; descriptionurl?: string; width?: number; extmetadata?: Record<string, { value?: string }> }
      | undefined;
    if (!info?.thumburl || (info.width ?? 0) < 800) continue;
    const license = stripHtml(info.extmetadata?.["LicenseShortName"]?.value ?? "");
    if (!FREE_LICENSE.test(license) || NOT_FREE.test(license)) continue;
    photos.push({
      title: page.title.replace(/^File:/, ""),
      pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      imageUrl: info.thumburl,
      author: stripHtml(info.extmetadata?.["Artist"]?.value ?? "inconnu").slice(0, 120),
      license,
    });
  }
  return photos;
}
