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

async function api(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(API);
  url.search = new URLSearchParams({ format: "json", ...params }).toString();
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Wikimedia API responded ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Photos filed in the Commons categories of a car generation, e.g.
 * "Category:Fiat Panda (type 319)". Variants (Cross, 4x4, Van…) live in
 * sub-categories, which are NOT descended into, so files here are mostly the
 * regular version, and photo series of one car (front/side/rear) sit together.
 */
const VARIANT_CATEGORY = /cross|4x4|4x40|trekking|van\b|natural power|abarth|sport|gti|\brs\b|cabrio|estate|break|\bsw\b|wagon|test drive|interior|engine|rally|police|taxi/i;

export async function categoryCarPhotos(
  queries: string[],
  mustContain: string,
  variant: string,
  limit = 60,
): Promise<CarPhoto[]> {
  const found: string[] = [];
  for (const q of queries) {
    const search = (await api({ action: "query", list: "search", srnamespace: "14", srsearch: q, srlimit: "6" })) as {
      query?: { search?: Array<{ title: string }> };
    };
    for (const { title } of search.query?.search ?? []) {
      if (!title.toLowerCase().includes(mustContain.toLowerCase()) || found.includes(title)) continue;
      // A standard car must not pull photos from Cross/4x4/Van… categories, and vice versa.
      const isVariantCategory = VARIANT_CATEGORY.test(title);
      if (variant === "standard" ? isVariantCategory : !title.toLowerCase().includes(variant.toLowerCase())) continue;
      found.push(title);
    }
    if (found.length >= 2) break;
  }
  const categories = found.slice(0, 2);

  const photos: CarPhoto[] = [];
  for (const category of categories) {
    const body = (await api({
      action: "query",
      generator: "categorymembers",
      gcmtitle: category,
      gcmtype: "file",
      gcmlimit: String(limit),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: "1000",
    })) as { query?: { pages?: Record<string, { title: string; imageinfo?: Array<Record<string, unknown>> }> } };
    photos.push(...toPhotos(body.query?.pages));
  }
  return photos;
}

function toPhotos(pages: Record<string, { title: string; imageinfo?: Array<Record<string, unknown>> }> | undefined): CarPhoto[] {
  const photos: CarPhoto[] = [];
  for (const page of Object.values(pages ?? {})) {
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
