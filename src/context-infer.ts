/**
 * Context window inference.
 * Priority: /v1/models API fields → known official catalog heuristics → 128k.
 *
 * Sources (checked 2026-08-01):
 * - OpenAI models: GPT-5.6 Sol/Terra/Luna context 1.05M
 * - xAI docs: grok-4.5 = 500k; grok-4.3 / grok-4.20* = 1M
 * - 智谱 model overview: GLM-5.2 = 1M; GLM-5.1/5/4.7/4.6 ≈ 200k; GLM-4.5-Air = 128k; GLM-4-Long = 1M
 * - Gemini (common API): 2.x/3.x class often 1M (gateway-dependent)
 *
 * Bump CONTEXT_CATALOG_VERSION when the table below changes so users can
 * run `/providers` →「应用最新上下文表」to refresh existing configs.
 */
export const CONTEXT_CATALOG_VERSION = 2;
export const CONTEXT_CATALOG_LABEL = "v2 (2026-08-01: grok-4.5=500k, glm-5.1=200k, gpt-5.6=1.05M)";

/** More specific patterns first. */
const KNOWN_CONTEXT: Array<{ pattern: RegExp; contextWindow: number; note?: string }> = [
  // OpenAI — GPT-5.6 frontier listed as 1.05M context
  { pattern: /gpt-5\.6/i, contextWindow: 1_050_000, note: "OpenAI GPT-5.6 catalog" },
  { pattern: /gpt-5(\.\d+)?/i, contextWindow: 1_000_000, note: "OpenAI GPT-5.x class (gateway alias)" },
  { pattern: /gpt-4\.1/i, contextWindow: 1_000_000 },
  { pattern: /gpt-4o/i, contextWindow: 128_000 },
  { pattern: /o3|o4-mini|o1/i, contextWindow: 200_000 },

  // xAI — official pricing table
  { pattern: /grok-4\.5/i, contextWindow: 500_000, note: "xAI: grok-4.5 = 500k" },
  { pattern: /grok-4\.3/i, contextWindow: 1_000_000, note: "xAI: grok-4.3 = 1M" },
  { pattern: /grok-4\.20/i, contextWindow: 1_000_000, note: "xAI: grok-4.20 = 1M" },
  { pattern: /grok-build/i, contextWindow: 256_000 },
  { pattern: /grok-4/i, contextWindow: 500_000, note: "xAI grok-4 family default → 4.5-class 500k" },
  { pattern: /grok-3/i, contextWindow: 131_072 },

  // Anthropic
  { pattern: /claude-(opus|sonnet|haiku)-4/i, contextWindow: 200_000 },
  { pattern: /claude-3/i, contextWindow: 200_000 },

  // Google Gemini (API common; flash-high aliases often 1M)
  { pattern: /gemini-3/i, contextWindow: 1_000_000 },
  { pattern: /gemini-2\.5/i, contextWindow: 1_000_000 },
  { pattern: /gemini-2\.0/i, contextWindow: 1_000_000 },
  { pattern: /gemini-1\.5-pro/i, contextWindow: 2_000_000 },
  { pattern: /gemini-1\.5/i, contextWindow: 1_000_000 },
  { pattern: /gemini/i, contextWindow: 1_000_000 },

  // 智谱 GLM — model overview table
  { pattern: /glm-5\.2/i, contextWindow: 1_000_000, note: "智谱 GLM-5.2 = 1M" },
  { pattern: /glm-5\.1/i, contextWindow: 200_000, note: "智谱 GLM-5.1 = 200k" },
  { pattern: /glm-5-turbo/i, contextWindow: 200_000 },
  { pattern: /glm-5v/i, contextWindow: 200_000 },
  { pattern: /glm-5(?![\d.])/i, contextWindow: 200_000, note: "智谱 GLM-5 = 200k" },
  { pattern: /glm-4\.7/i, contextWindow: 200_000 },
  { pattern: /glm-4\.6v/i, contextWindow: 128_000 },
  { pattern: /glm-4\.6/i, contextWindow: 200_000 },
  { pattern: /glm-4\.5-air/i, contextWindow: 128_000 },
  { pattern: /glm-4\.5/i, contextWindow: 128_000 },
  { pattern: /glm-4-long/i, contextWindow: 1_000_000 },
  { pattern: /glm-4/i, contextWindow: 128_000 },
  { pattern: /chatglm/i, contextWindow: 128_000 },

  // DeepSeek / Qwen / Kimi / MiniMax (common published windows)
  { pattern: /deepseek/i, contextWindow: 128_000 },
  { pattern: /qwen3/i, contextWindow: 256_000 },
  { pattern: /qwen2\.5/i, contextWindow: 128_000 },
  { pattern: /qwen/i, contextWindow: 128_000 },
  { pattern: /kimi|moonshot/i, contextWindow: 256_000 },
  { pattern: /minimax/i, contextWindow: 1_000_000 },
];

const FIELD_NAMES = [
  "context_window",
  "context_length",
  "contextWindow",
  "contextLength",
  "max_model_len",
  "max_context_length",
  "max_input_tokens",
  "n_ctx",
  "max_tokens",
] as const;

export function extractContextFromRow(row: Record<string, unknown>): number | undefined {
  for (const key of FIELD_NAMES) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 1000) {
      if (key === "max_tokens" && v < 8000) continue;
      return Math.floor(v);
    }
    if (typeof v === "string" && /^\d+$/.test(v)) {
      const n = Number(v);
      if (n >= 1000) {
        if (key === "max_tokens" && n < 8000) continue;
        return n;
      }
    }
  }
  const meta = row.metadata;
  if (meta && typeof meta === "object") {
    const nested = extractContextFromRow(meta as Record<string, unknown>);
    if (nested) return nested;
  }
  return undefined;
}

export function inferContextFromModelId(id: string): number | undefined {
  for (const { pattern, contextWindow } of KNOWN_CONTEXT) {
    if (pattern.test(id)) return contextWindow;
  }
  return undefined;
}

export function resolveContextWindow(opts: {
  id: string;
  fromApi?: number;
  fallback?: number;
}): number {
  if (opts.fromApi && opts.fromApi >= 1000) return opts.fromApi;
  const inferred = inferContextFromModelId(opts.id);
  if (inferred) return inferred;
  return opts.fallback ?? 128_000;
}
