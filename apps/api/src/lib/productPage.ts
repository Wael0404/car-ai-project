import { config } from "../config.js";

/**
 * Reads a shop's product page (no AI, free) to get the part photo and its
 * manufacturer reference: og:image / JSON-LD / schema.org microdata, which
 * most Tunisian shops (PrestaShop, WooCommerce) publish for Google.
 *
 * Only pages of the configured shop domains are fetched (the URLs come from
 * an AI agent and from third-party HTML: never let them reach other hosts).
 * The HTML is untrusted: parsing uses only linear-time patterns (tags first,
 * then attributes inside one tag), so a hostile page cannot stall the worker.
 */

export interface ProductInfo {
  imageUrl: string | null;
  reference: string | null;
  brand: string | null;
  /** Product name as the shop page writes it (to detect a URL/title mismatch). */
  pageName: string | null;
}

const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36";
const MAX_HTML_BYTES = 1_500_000;
/** Whole request budget, redirects included. */
const TIMEOUT_MS = 12_000;

function shopDomains(): string[] {
  return config.PRICE_DOMAINS.split(",")
    .map((d) => d.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
}

/** http(s) URL on one of the shop domains (or a subdomain), default port. */
export function isAllowedShopUrl(raw: string, domains: string[] = shopDomains()): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.port !== "" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * GET with redirects followed by hand, each hop re-checked against the
 * allowlist, one overall timeout and a size cap. Null when refused or failed.
 */
export async function safeFetch(
  url: string,
  accept: string,
  maxBytes: number,
): Promise<{ body: Buffer; contentType: string; finalUrl: string } | null> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedShopUrl(current)) return null;
    const res = await fetch(current, {
      headers: { "user-agent": UA, accept, "accept-language": "fr-FR,fr;q=0.9" },
      redirect: "manual",
      signal,
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      await res.body?.cancel();
      if (!next) return null;
      current = new URL(next, current).toString();
      continue;
    }
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      return null;
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
      await res.body.cancel();
      return null;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.byteLength;
      if (size > maxBytes) return null; // leaving the loop cancels the stream
      chunks.push(Buffer.from(chunk));
    }
    return { body: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "", finalUrl: current };
  }
  return null;
}

/* ------------------------------ HTML parsing ------------------------------ */

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

interface Tag {
  name: string;
  text: string;
  end: number;
}

/** Every start tag, in one linear pass ("[^<>]" cannot overlap the next tag). */
function startTags(html: string): Tag[] {
  const tags: Tag[] = [];
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]{0,15})\b[^<>]{0,4000}>/g)) {
    tags.push({ name: m[1]!.toLowerCase(), text: m[0], end: m.index! + m[0].length });
  }
  return tags;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  if (!m) return null;
  const v = m[1] ?? m[2] ?? m[3] ?? "";
  return v.trim() ? decode(v) : null;
}

function metaContent(tags: Tag[], name: string): string | null {
  const wanted = name.toLowerCase();
  for (const t of tags) {
    if (t.name !== "meta") continue;
    const key = attr(t.text, "property") ?? attr(t.text, "name") ?? attr(t.text, "itemprop");
    if (key?.toLowerCase() === wanted) {
      const content = attr(t.text, "content");
      if (content) return content;
    }
  }
  return null;
}

/** Value of a schema.org microdata property: content="", src="" or the tag's text. */
function itemprop(html: string, tags: Tag[], name: string): string | null {
  for (const t of tags) {
    const props = attr(t.text, "itemprop");
    if (!props || !props.toLowerCase().split(/\s+/).includes(name)) continue;
    const value = attr(t.text, "content") ?? attr(t.text, "src");
    if (value) return value;
    const text = html.slice(t.end, t.end + 120).match(/^\s*([^<]{2,60})/)?.[1];
    if (text && text.trim()) return decode(text);
  }
  return null;
}

interface LdProduct {
  name?: unknown;
  sku?: unknown;
  mpn?: unknown;
  brand?: unknown;
  image?: unknown;
}

function ldProduct(html: string, tags: Tag[]): LdProduct | null {
  let seen = 0;
  for (const t of tags) {
    if (t.name !== "script" || !/ld\+json/i.test(t.text)) continue;
    if (++seen > 20) break;
    const close = html.indexOf("</script>", t.end);
    if (close < 0 || close - t.end > 300_000) continue;
    try {
      const json = JSON.parse(html.slice(t.end, close)) as unknown;
      const nodes: unknown[] = Array.isArray(json)
        ? json
        : json && typeof json === "object" && Array.isArray((json as { "@graph"?: unknown[] })["@graph"])
          ? (json as { "@graph": unknown[] })["@graph"]
          : [json];
      const product = nodes.find(
        (n) => n && typeof n === "object" && /Product/.test(String((n as { "@type"?: unknown })["@type"])),
      );
      if (product) return product as LdProduct;
    } catch {
      // Broken JSON-LD is common: ignore it.
    }
  }
  return null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? decode(v) : null);
const firstImage = (v: unknown): string | null =>
  str(v) ?? (Array.isArray(v) ? firstImage(v[0]) : v && typeof v === "object" ? str((v as { url?: unknown }).url) : null);

export const squash = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * A manufacturer reference looks like "L008", "C 2295/3", "5PK1153",
 * "0 986 494 527". Rejected: barcodes (EAN/UPC, 12-14 digits) and a plain
 * number that is the shop's own product id (in the page URL, not in the title).
 */
export function cleanReference(raw: string | null, pageUrl: string, productTitle = ""): string | null {
  if (!raw) return null;
  const ref = raw.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  if (ref.length < 3 || ref.length > 30) return null;
  if (!/\d/.test(ref) || !/^[A-Za-z0-9][A-Za-z0-9 ./-]*$/.test(ref)) return null;
  const digits = ref.replace(/[\s.-]/g, "");
  if (/^\d{12,14}$/.test(digits)) return null; // EAN-13 / UPC / GTIN-14
  if (/^\d+$/.test(ref)) {
    let inUrl = false;
    try {
      const u = new URL(pageUrl);
      inUrl = new RegExp(`(^|[^0-9])${ref}([^0-9]|$)`).test(u.pathname + u.search);
    } catch {
      // keep inUrl false
    }
    if (inUrl && !squash(productTitle).includes(ref)) return null;
  }
  return ref;
}

function cleanImage(raw: string | null, pageUrl: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, pageUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Shop logos and category banners are not the part.
    if (/logo|placeholder|no[-_]?image|default[-_]?img|\/img\/c\//i.test(u.pathname)) return null;
    if (/\.svg$/i.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function titleTag(html: string): string | null {
  const start = html.search(/<title\b[^<>]{0,200}>/i);
  if (start < 0) return null;
  const open = html.indexOf(">", start) + 1;
  const close = html.indexOf("<", open);
  if (close < 0 || close - open > 300) return null;
  return decode(html.slice(open, close)) || null;
}

/** Pure parser (unit-tested): photo, reference, brand and name from a product page. */
export function parseProductPage(html: string, pageUrl: string, productTitle = ""): ProductInfo {
  const tags = startTags(html);
  const ld = ldProduct(html, tags);

  const imageCandidates = [
    metaContent(tags, "og:image"),
    metaContent(tags, "og:image:secure_url"),
    metaContent(tags, "twitter:image"),
    firstImage(ld?.image),
    itemprop(html, tags, "image"),
    tags.find((t) => t.name === "link" && attr(t.text, "rel")?.toLowerCase() === "image_src")?.text ?? null,
  ].map((c, i) => (i === 5 && c ? attr(c, "href") : c));
  const imageUrl = imageCandidates.map((c) => cleanImage(c, pageUrl)).find(Boolean) ?? null;

  // mpn is the maker's part number. sku is the shop's own code: trusted only
  // when the product title also contains it.
  const clean = (r: string | null) => cleanReference(r, pageUrl, productTitle);
  const mpns = [itemprop(html, tags, "mpn"), str(ld?.mpn)].map(clean).filter((r): r is string => r !== null);
  const skus = [itemprop(html, tags, "sku"), str(ld?.sku)].map(clean).filter((r): r is string => r !== null);
  const title = squash(productTitle);
  const reference = [...mpns, ...skus].find((r) => title.includes(squash(r))) ?? mpns[0] ?? null;

  const brandRaw =
    str(ld?.brand) ??
    (ld?.brand && typeof ld.brand === "object" ? str((ld.brand as { name?: unknown }).name) : null) ??
    metaContent(tags, "product:brand") ??
    itemprop(html, tags, "brand");
  const brand = brandRaw && brandRaw.length <= 40 && !/^https?:/i.test(brandRaw) ? brandRaw : null;

  const pageName = str(ld?.name) ?? metaContent(tags, "og:title") ?? titleTag(html);
  return { imageUrl, reference, brand, pageName: pageName ? pageName.slice(0, 200) : null };
}

/**
 * True when the page clearly shows another product than the one the agent
 * described (other oil grade, or another part number): then its photo and
 * reference must not be shown for this offer.
 */
export function pageContradicts(productTitle: string, agentReference: string | null | undefined, info: ProductInfo): boolean {
  if (!info.pageName) return false;
  const grade = (s: string) => s.match(/\b(\d{1,2})\s?w\s?-?\s?(\d{2})\b/i)?.slice(1, 3).join("w");
  const a = grade(productTitle);
  const b = grade(info.pageName);
  if (a && b && a !== b) return true;
  if (agentReference && info.reference && squash(agentReference) !== squash(info.reference)) {
    return !squash(info.pageName).includes(squash(agentReference));
  }
  return false;
}

/** Null when the page could not be read (network error, 403, too big...): retry later. */
export async function fetchProductInfo(url: string, productTitle: string): Promise<ProductInfo | null> {
  const page = await safeFetch(url, "text/html,application/xhtml+xml", MAX_HTML_BYTES);
  if (!page || !/html/i.test(page.contentType)) return null;
  return parseProductPage(page.body.toString("utf8"), page.finalUrl, productTitle);
}
