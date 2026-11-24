/**
 * Public Sketchfab search (no account needed). We only *search* and *embed*
 * with the official viewer; we never download files, which Sketchfab's
 * Download API terms reserve to end-user OAuth.
 * https://sketchfab.com/developers/data-api/v3
 */

export interface SketchfabCandidate {
  uid: string;
  name: string;
  description: string;
  author: string;
  license: string | null;
  viewerUrl: string;
  thumbnailUrl: string | null;
  faceCount: number;
  tags: string[];
}

interface SearchResult {
  uid: string;
  name: string;
  description?: string;
  user?: { username?: string };
  license?: { label?: string } | string | null;
  viewerUrl: string;
  isAgeRestricted?: boolean;
  faceCount?: number;
  tags?: Array<{ name: string }>;
  thumbnails?: { images?: Array<{ url: string; width: number }> };
}

function pickThumbnail(images: Array<{ url: string; width: number }> = []): string | null {
  // ~512 px is enough for the vision check and cheap in tokens.
  const sorted = [...images].sort((a, b) => Math.abs(a.width - 512) - Math.abs(b.width - 512));
  return sorted[0]?.url ?? null;
}

export async function searchSketchfab(query: string, count = 24): Promise<SketchfabCandidate[]> {
  const url = new URL("https://api.sketchfab.com/v3/search");
  url.searchParams.set("type", "models");
  url.searchParams.set("q", query);
  url.searchParams.set("categories", "cars-vehicles");
  url.searchParams.set("count", String(count));

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Sketchfab search responded ${res.status}`);
  const body = (await res.json()) as { results?: SearchResult[] };

  return (body.results ?? [])
    .filter((r) => !r.isAgeRestricted)
    .map((r) => ({
      uid: r.uid,
      name: r.name,
      description: (r.description ?? "").slice(0, 300),
      author: r.user?.username ?? "inconnu",
      license: typeof r.license === "string" ? r.license : (r.license?.label ?? null),
      viewerUrl: r.viewerUrl,
      thumbnailUrl: pickThumbnail(r.thumbnails?.images),
      faceCount: r.faceCount ?? 0,
      tags: (r.tags ?? []).map((t) => t.name).slice(0, 15),
    }));
}
