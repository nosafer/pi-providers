/**
 * Lookup contextWindow / reasoning / thinkingLevelMap from pi-ai official
 * provider catalogs (generated into src/generated/pi-ai-catalog.json).
 *
 * This is the preferred source of truth for "what does this model support".
 * Heuristics in context-infer / reasoning-infer remain as fallback for unknown ids.
 */

import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
      canonicalId?: string;
      input?: string[];
    }
  >;
};

const CATALOG_URL = new URL("./generated/pi-ai-catalog.json", import.meta.url);
const CATALOG_PATH = fileURLToPath(CATALOG_URL);

let cachedData: CatalogFile | undefined;
let cachedMtimeMs = -1;

/**
 * Lazy-load the catalog from disk, re-reading when the file changes.
 * Safe for concurrent calls (worst case: one extra parse after a write).
 */
function getData(): CatalogFile {
  const mtimeMs = statSync(CATALOG_PATH).mtimeMs;
  if (cachedData && mtimeMs === cachedMtimeMs) return cachedData;
  const raw = readFileSync(CATALOG_PATH, "utf8");
  cachedData = JSON.parse(raw) as CatalogFile;
  cachedMtimeMs = mtimeMs;
  return cachedData;
}

export function getCatalogMeta(): { version: number; modelCount: number } {
  const data = getData();
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
  const models = getData().models;
  const key = normalizeKey(modelId);
  const bare = bareId(modelId);

  const tryKeys: string[] = [];
  // Date-stamp stripping (4/8-digit MMDD or YYYYMMDD) goes BEFORE exact match:
  // third-party gateways name snapshots deepseek-v4-flash-0731, and such catalog
  // entries often carry an incomplete thinkingLevelMap (e.g. together's -0731
  // only lists minimal/low/medium nulls). Stripping first lands on the official
  // base entry (deepseek-v4-flash) with full high/max profile.
  for (const id of [key, bare]) {
    tryKeys.push(id.replace(/-\d{4,8}(-v\d+)?(:\d+)?$/i, ""));
  }
  tryKeys.push(key, bare);
  // strip trailing -preview, semantic suffixes lightly
  tryKeys.push(bare.replace(/-preview$/, ""));
  // gemini-3.6-flash-high → gemini-3.6-flash
  tryKeys.push(bare.replace(/-(high|low|medium|thinking|fast|free|batch)$/i, ""));

  for (const k of tryKeys) {
    const hit = models[k];
    if (hit) {
      return { ...hit, canonicalId: hit.canonicalId ?? k, matchedKey: k };
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
    if (hit) return { ...hit, canonicalId: hit.canonicalId ?? best.k, matchedKey: best.k };
  }
  return undefined;
}
