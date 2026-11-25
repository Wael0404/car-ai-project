import type Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side refusal fallback: if the model declines, the API re-runs the
 * request on a fallback model in the same call. Claude Haiku has no
 * server-side fallback, so nothing is sent for it.
 */
export function fallbackParams(model: string): Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks"> {
  if (model.startsWith("claude-haiku")) return {};
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}
