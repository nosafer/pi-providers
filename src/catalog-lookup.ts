/**
 * Lookup contextWindow / reasoning / thinkingLevelMap from pi-ai official
 * provider catalogs (generated into src/generated/pi-ai-catalog.json).
 *
 * This is the preferred source of truth for "what does this model support".
 * Heuristics in context-infer / reasoning-infer remain as fallback for unknown ids.
 */

import catalog from "./generated/pi-ai-catalog.json" with { type: "json" };
import type { ThinkingLevelMap } from "./types.ts";

export interface CatalogHit {
  contextWindow?: number;
  maxTokens?: number;
  reasoning: boolean;
  thinkingLevelMap?: ThinkingLevelMap;
  source: string;
  canonicalId: string;
  input?: string[];
  matchedKey: string;
}

type CatalogFile = {
  version: number;
  modelCount: number;
  models: Record<
    string,
    {
      contextWindow?: number;
      maxTokens?: number;
      reasoning: boolean;
      thinkingLevelMap?: ThinkingLevelMap;
      source: string;
      canonicalId: string;
      input?: string[];
    }
  >;
};

const data = catalog as CatalogFile;

export function getCatalogMeta(): { version: number; modelCount: number } {
  return { version: data.version, modelCount: data.modelCount };
}

function normalizeKey(id: string): string {
  return id.trim().toLowerCase();
}

/** Strip common gateway prefixes: openai/, anthropic/, google/, etc. */
function bareId(id: string): string {
  const n = normalizeKey(id);
  const parts = n.split("/");
  return parts[parts.length - 1] ?? n;
}

/**
 * Resolve model id against pi-ai catalog.
 * Tries: exact → bare → strip date/suffix variants → prefix/contains fuzzy.
 */
export function lookupPiAiCatalog(modelId: string): CatalogHit | undefined {
  const models = data.models;
  const key = normalizeKey(modelId);
  const bare = bareId(modelId);

  const tryKeys = [key, bare];
  // strip trailing -preview, -batch, date stamps lightly
  tryKeys.push(bare.replace(/-preview$/, ""));
  tryKeys.push(bare.replace(/-\d{8}$/, ""));
  // gemini-3.6-flash-high → gemini-3.6-flash
  tryKeys.push(bare.replace(/-(high|low|medium|thinking|fast|free|batch)$/i, ""));
  // claude-sonnet-4-5-20250929 → claude-sonnet-4-5
  tryKeys.push(bare.replace(/-\d{8}(-v\d+)?(:\d+)?$/i, ""));

  for (const k of tryKeys) {
    const hit = models[k];
    if (hit) {
      return { ...hit, matchedKey: k };
    }
  }

  // Fuzzy: longest catalog key that is a prefix of bare, or bare prefix of key
  let best: { k: string; score: number } | undefined;
  for (const k of Object.keys(models)) {
    if (k.length < 6) continue;
    if (bare.startsWith(k) || k.startsWith(bare)) {
      const score = Math.min(k.length, bare.length);
      if (!best || score > best.score) best = { k, score };
    }
    // shared prefix length for close names
    let i = 0;
    while (i < k.length && i < bare.length && k[i] === bare[i]) i++;
    if (i >= 12 && i / Math.max(k.length, bare.length) > 0.75) {
      if (!best || i > best.score) best = { k, score: i };
    }
  }
  if (best && best.score >= 10) {
    const hit = models[best.k];
    if (hit) return { ...hit, matchedKey: best.k };
  }
  return undefined;
}
