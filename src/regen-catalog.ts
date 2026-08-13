/**
 * Regenerate src/generated/pi-ai-catalog.json from the installed pi-ai
 * provider data (TS port of scripts/regen-pi-ai-catalog.py).
 *
 * Runs automatically inside /providers sync-catalog when the installed
 * pi-ai data differs from the current catalog, so users never have to
 * regenerate by hand after a pi upgrade.
 */

import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findPiAiDataDir, findPiAiDataFiles } from "./pi-ai-data.ts";

const OUT_PATH = fileURLToPath(new URL("./generated/pi-ai-catalog.json", import.meta.url));

/** Provider priority: earlier wins when the same bare id appears in multiple catalogs. */
const PRIORITY = [
  "moonshotai-cn", "moonshotai", "kimi-coding",
  "anthropic", "openai", "openai-codex", "xai", "google", "google-vertex",
  "deepseek", "zai", "zai-coding-cn", "minimax", "minimax-cn",
  "mistral", "groq", "cerebras", "together", "fireworks", "nvidia",
  "huggingface", "github-copilot", "azure-openai-responses",
  "amazon-bedrock", "cloudflare-ai-gateway", "cloudflare-workers-ai",
  "qwen-token-plan", "qwen-token-plan-cn", "xiaomi",
  "opencode", "opencode-go", "openrouter", "vercel-ai-gateway",
  "ant-ling",
];

const DOT_PREFIXES = ["anthropic.", "openai.", "us.", "eu.", "global.", "jp.", "au.", "zai."];

/** A raw model entry as found in pi-ai provider JSON files. */
type SourceModel = {
  id: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
  thinkingLevelMap?: Record<string, string | null>;
  input?: string[];
};

/** A normalized catalog entry (the shape written to pi-ai-catalog.json). */
type CatalogEntry = {
  contextWindow?: number;
  maxTokens?: number;
  reasoning: boolean;
  thinkingLevelMap?: Record<string, string | null>;
  input?: string[];
  source: string;
  canonicalId: string;
};

export type CatalogFile = {
  version: number;
  generatedFrom: string;
  modelCount: number;
  models: Record<string, CatalogEntry>;
};

function collectCandidates(): Map<string, Array<[number, CatalogEntry]>> {
  const prio = new Map(PRIORITY.map((n, i) => [n, i]));
  const candidates = new Map<string, Array<[number, CatalogEntry]>>();

  for (const path of findPiAiDataFiles()) {
    const fileStem = path.split("/").pop()!.replace(/\.json$/, "");
    const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    for (const [, models] of Object.entries(data)) {
      if (!models || typeof models !== "object") continue;
      for (const m of Object.values(models)) {
        if (!m || typeof m !== "object" || typeof (m as SourceModel).id !== "string") continue;
        const raw = m as SourceModel;
        const fullId = raw.id;
        const bare = fullId.split("/").pop()!;
        let bare2 = bare;
        if (DOT_PREFIXES.some((p) => bare.startsWith(p))) {
          bare2 = bare.split(".").pop()!;
        }
        const keys = new Set<string>([fullId.toLowerCase(), bare.toLowerCase()]);
        if (bare2.toLowerCase() !== bare.toLowerCase()) keys.add(bare2.toLowerCase());
        const entry: CatalogEntry = {
          contextWindow: raw.contextWindow,
          maxTokens: raw.maxTokens,
          reasoning: Boolean(raw.reasoning),
          thinkingLevelMap: raw.thinkingLevelMap,
          input: raw.input,
          source: fileStem,
          canonicalId: fullId,
        };
        const rank = prio.get(fileStem) ?? 1000;
        for (const k of keys) {
          const list = candidates.get(k) ?? [];
          list.push([rank, entry]);
          candidates.set(k, list);
        }
      }
    }
  }
  return candidates;
}

/** Build the merged index: best (lowest rank) entry per key wins. */
export function buildCatalogIndex(): CatalogFile {
  const candidates = collectCandidates();
  const index: Record<string, CatalogEntry> = {};
  for (const [key, items] of candidates) {
    items.sort((a, b) => a[0] - b[0]);
    const best = items[0][1];
    const rec: CatalogEntry = {
      contextWindow: best.contextWindow,
      maxTokens: best.maxTokens,
      reasoning: best.reasoning,
      thinkingLevelMap: best.thinkingLevelMap,
      input: best.input,
      source: best.source,
      canonicalId: best.canonicalId,
    };
    index[key] = rec;
  }
  return {
    version: 1,
    generatedFrom: "pi-ai dist/providers/data",
    modelCount: Object.keys(index).length,
    models: index,
  };
}

/**
 * Regenerate the catalog file from installed pi-ai data.
 * Returns the new model count, or undefined when pi-ai data is missing.
 */
export function regenCatalogFromInstalledPiAi(): number | undefined {
  if (findPiAiDataFiles().length === 0) return undefined;
  const out = buildCatalogIndex();
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out), "utf8");
  return out.modelCount;
}

/**
 * Check whether installed pi-ai data is newer than the current catalog and
 * regenerate if so. Returns a user-facing note when a regen happened, else
 * undefined. Cheap when nothing changed (only stat calls). Safe for
 * concurrent calls; the write is idempotent.
 */
export function maybeAutoRegenCatalog(): string | undefined {
  const dataDir = findPiAiDataDir();
  if (!dataDir) return undefined;
  if (!existsSync(OUT_PATH)) {
    const n = regenCatalogFromInstalledPiAi();
    return n !== undefined ? `已从 pi-ai 官方数据生成 catalog（${n} 模型）` : undefined;
  }
  const catMtime = statSync(OUT_PATH).mtimeMs;
  const dataFiles = findPiAiDataFiles();
  const newest = dataFiles
    .map((f) => statSync(f).mtimeMs)
    .reduce((a, b) => Math.max(a, b), 0);
  if (newest > catMtime + 1000) {
    const n = regenCatalogFromInstalledPiAi();
    return n !== undefined ? `pi-ai 官方数据已更新 → 自动重新生成 catalog（${n} 模型）` : undefined;
  }
  return undefined;
}
