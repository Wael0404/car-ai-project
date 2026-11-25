import type Anthropic from "@anthropic-ai/sdk";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * Downloads an image ourselves and returns it as a base64 block. Letting the
 * API fetch URLs fails the whole request when one site refuses its fetcher
 * (seen with Wikimedia); here a failing image is just skipped (null).
 */
export async function imageBlock(url: string): Promise<Anthropic.Beta.BetaImageBlockParam | null> {
  // Wikimedia thumbnails: ask for the 500 px size, enough to judge the car.
  url = url.replace(/\/\d+px-/, "/500px-");
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "CarAI/0.1 (car photo check)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim() as (typeof IMAGE_TYPES)[number];
    if (!IMAGE_TYPES.includes(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
    return { type: "image", source: { type: "base64", media_type: type, data: bytes.toString("base64") } };
  } catch {
    return null;
  }
}

/**
 * Server-side refusal fallback: if the model declines, the API re-runs the
 * request on a fallback model in the same call. Claude Haiku has no
 * server-side fallback, so nothing is sent for it.
 */
export function fallbackParams(model: string): Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks"> {
  if (model.startsWith("claude-haiku")) return {};
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}

/**
 * Web search tool for this model. The dynamic-filtering variant (20260209)
 * is for Opus / Sonnet / Fable; Claude Haiku mis-formats its queries with it
 * (invalid_tool_input, then max_uses_exceeded), so Haiku gets the basic one.
 */
export function webSearchTool(model: string, maxUses: number, allowedDomains: string[] = []): Anthropic.Beta.BetaToolUnion {
  const domains = allowedDomains.length > 0 ? { allowed_domains: allowedDomains } : {};
  return model.startsWith("claude-haiku")
    ? { type: "web_search_20250305", name: "web_search", max_uses: maxUses, ...domains }
    : { type: "web_search_20260209", name: "web_search", max_uses: maxUses, ...domains };
}
