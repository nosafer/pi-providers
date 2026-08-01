/**
 * Infer context window from OpenAI-compatible /models payload fields
 * and well-known model id patterns when the gateway omits metadata.
 */

const KNOWN_CONTEXT: Array<{ pattern: RegExp; contextWindow: number }> = [
  // OpenAI GPT-5.x long context
  { pattern: /gpt-5(\.\d+)?/i, contextWindow: 1_000_000 },
  { pattern: /gpt-4\.1/i, contextWindow: 1_000_000 },
  { pattern: /gpt-4o/i, contextWindow: 128_000 },
  // Anthropic
  { pattern: /claude-(opus|sonnet|haiku)-4/i, contextWindow: 200_000 },
  { pattern: /claude-3\.5/i, contextWindow: 200_000 },
  { pattern: /claude-3/i, contextWindow: 200_000 },
  // Google
  { pattern: /gemini-3/i, contextWindow: 1_000_000 },
  { pattern: /gemini-2\.5/i, contextWindow: 1_000_000 },
  { pattern: /gemini-2\.0/i, contextWindow: 1_000_000 },
  { pattern: /gemini-1\.5/i, contextWindow: 1_000_000 },
  // xAI — Grok 4.x class commonly 1M on gateways
  { pattern: /grok-4/i, contextWindow: 1_000_000 },
  { pattern: /grok-3/i, contextWindow: 131_072 },
  // DeepSeek
  { pattern: /deepseek-r1/i, contextWindow: 128_000 },
  { pattern: /deepseek-v3/i, contextWindow: 128_000 },
  { pattern: /deepseek/i, contextWindow: 128_000 },
  // GLM / ChatGLM (Zhipu) — 5.x often 256k class on gateways
  { pattern: /glm-5/i, contextWindow: 256_000 },
  { pattern: /glm-4\.?5/i, contextWindow: 128_000 },
  { pattern: /glm-4/i, contextWindow: 128_000 },
  { pattern: /chatglm/i, contextWindow: 128_000 },
  // Qwen
  { pattern: /qwen3/i, contextWindow: 256_000 },
  { pattern: /qwen2\.5/i, contextWindow: 128_000 },
  { pattern: /qwen/i, contextWindow: 128_000 },
  // Kimi / Moonshot
  { pattern: /kimi|moonshot/i, contextWindow: 256_000 },
  // MiniMax
  { pattern: /minimax/i, contextWindow: 1_000_000 },
];

const FIELD_NAMES = [
  "context_window",
  "context_length",
  "contextWindow",
  "contextLength",
  "max_model_len",
  "max_context_length",
  "max_tokens", // last resort; some gateways misuse this for context
  "max_input_tokens",
  "n_ctx",
] as const;

export function extractContextFromRow(row: Record<string, unknown>): number | undefined {
  for (const key of FIELD_NAMES) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 1000) {
      // if it looks like max_tokens for output (tiny), skip
      if (key === "max_tokens" && v < 8000) continue;
      return Math.floor(v);
    }
    if (typeof v === "string" && /^\d+$/.test(v)) {
      const n = Number(v);
      if (n >= 1000) return n;
    }
  }
  // nested common shapes
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
