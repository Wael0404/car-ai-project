import type Anthropic from "@anthropic-ai/sdk";
import pino from "pino";

/**
 * Logs what each Claude call really cost, so spending stays visible.
 * Prices in USD per million tokens (Claude API list prices, Nov 2026).
 */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
const WEB_SEARCH_PER_REQUEST = 10 / 1000; // $10 per 1,000 searches

const log = pino({ name: "claude-cost" });

type Usage = Anthropic.Beta.BetaUsage;

export function costOf(model: string, usage: Usage): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"]!; // unknown model: assume the dearest
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  return (
    ((usage.input_tokens + cacheWrite * 1.25) * p.input + usage.output_tokens * p.output + cacheRead * p.cacheRead) /
      1_000_000 +
    searches * WEB_SEARCH_PER_REQUEST
  );
}

/** Records one call (or the sum of an agent's calls) and returns its cost in USD. */
export function recordUsage(task: string, model: string, usages: Usage[]): number {
  const cost = usages.reduce((sum, u) => sum + costOf(model, u), 0);
  const tokens = usages.reduce(
    (t, u) => ({ input: t.input + u.input_tokens, output: t.output + u.output_tokens }),
    { input: 0, output: 0 },
  );
  const searches = usages.reduce((n, u) => n + (u.server_tool_use?.web_search_requests ?? 0), 0);
  log.info({ task, model, calls: usages.length, ...tokens, searches, costUsd: Number(cost.toFixed(4)) }, "Claude usage");
  return cost;
}
