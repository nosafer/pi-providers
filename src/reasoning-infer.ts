/**
 * Infer reasoning + thinkingLevelMap.
 * Priority: pi-ai official catalog (generated) → pattern fallbacks → non-reasoning.
 */

import { lookupPiAiCatalog } from "./catalog-lookup.ts";

export type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export type ThinkingLevelMap = Partial<Record<ThinkingLevel, string | null>>;

export const ALL_THINKING_LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export interface ReasoningProfile {
  reasoning: boolean;
  thinkingLevelMap?: ThinkingLevelMap;
  note?: string;
}

/** Moonshot Kimi K3 official: reasoning_effort low | high | max (default max) */
const KIMI_K3_MAP: ThinkingLevelMap = {
  off: null,
  minimal: null,
  low: "low",
  medium: null,
  high: "high",
  xhigh: null,
  max: "max",
};

/** xAI Grok 4.5 (pi-ai opencode/xai catalog) */
const GROK_45_MAP: ThinkingLevelMap = {
  off: null,
  minimal: null,
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: null,
  max: null,
};

/** GPT-5.5 class (pi-ai): low..xhigh, no off/max */
const GPT_55_MAP: ThinkingLevelMap = {
  off: null,
  minimal: null,
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: null,
};

/** GPT-5.6 Sol/Terra/Luna: includes max */
const GPT_56_MAP: ThinkingLevelMap = {
  off: null,
  minimal: null,
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "max",
};

/** DeepSeek V4 / GLM-5.2 style: high + max only (often always-on lower levels) */
const HIGH_MAX_MAP: ThinkingLevelMap = {
  off: null,
  minimal: null,
  low: null,
  medium: null,
  high: "high",
  xhigh: null,
  max: "max",
};

/** Always-on thinking (Gemini 3 flash class): only document off=null */
const ALWAYS_ON_MAP: ThinkingLevelMap = {
  off: null,
};

/** Claude adaptive with max (opus 4.6+) */
const CLAUDE_MAX_MAP: ThinkingLevelMap = {
  max: "max",
};

const CLAUDE_XHIGH_MAX_MAP: ThinkingLevelMap = {
  xhigh: "xhigh",
  max: "max",
};

/**
 * More specific patterns first.
 * Maps copied/adapted from pi-ai official JSON catalogs where available.
 */
const PROFILES: Array<{ pattern: RegExp; profile: ReasoningProfile }> = [
  // —— Kimi / Moonshot (official K3: low/high/max) ——
  {
    pattern: /kimi-k3|kimi_k3|\bk3\b/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: KIMI_K3_MAP,
      note: "Moonshot Kimi K3: low/high/max (default max)",
    },
  },
  {
    pattern: /kimi-k2\.7-code|k2\.7-code/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: { off: null },
      note: "Kimi K2.7 Code: thinking always on (pi-ai)",
    },
  },
  {
    pattern: /kimi-k2\.6|kimi-k2\.5|kimi-k2-thinking|moonshot/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: undefined, // pi default off..high when reasoning true
      note: "Kimi K2.5/2.6 thinking (binary / deepseek format on some routes)",
    },
  },
  {
    pattern: /kimi/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: KIMI_K3_MAP,
      note: "Kimi generic → K3-style low/high/max",
    },
  },

  // —— OpenAI GPT ——
  {
    pattern: /gpt-5\.6/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: GPT_56_MAP,
      note: "GPT-5.6: low..max",
    },
  },
  {
    pattern: /gpt-5\.5/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: GPT_55_MAP,
      note: "GPT-5.5: low..xhigh",
    },
  },
  {
    pattern: /gpt-5\.4-pro|gpt-5\.2|gpt-5\.3|gpt-5\.4|gpt-5\.1-codex-max/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: {
        off: null,
        minimal: null,
        low: "low",
        medium: "medium",
        high: "high",
        xhigh: "xhigh",
        max: null,
      },
      note: "GPT-5.x with xhigh",
    },
  },
  {
    pattern: /gpt-5|o3|o4-mini|o1/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: {
        off: null,
        minimal: "minimal",
        low: "low",
        medium: "medium",
        high: "high",
        xhigh: null,
        max: null,
      },
      note: "GPT-5 / o-series effort",
    },
  },

  // —— xAI Grok ——
  {
    pattern: /grok-4\.5/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: GROK_45_MAP,
      note: "Grok 4.5: low/medium/high (pi-ai)",
    },
  },
  {
    pattern: /grok-4|grok-build/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: GROK_45_MAP,
      note: "Grok 4.x class",
    },
  },

  // —— Anthropic Claude / Claude Code aliases ——
  // pi-ai: opus-4.7/4.8/5, sonnet-5, fable → xhigh+max adaptive
  {
    pattern:
      /claude-opus-4-[789]|claude-opus-5|claude-sonnet-5|claude-fable|claude-code|opus-4-[789]|sonnet-5/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: CLAUDE_XHIGH_MAX_MAP,
      note: "Claude adaptive: off..high + xhigh/max (pi-ai)",
    },
  },
  {
    pattern: /claude-(opus|sonnet)-4-6|claude-opus-4-6|claude-sonnet-4-6/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: CLAUDE_MAX_MAP,
      note: "Claude 4.6 adaptive + max",
    },
  },
  {
    pattern: /claude-(opus|sonnet|haiku)-4|claude-3\.7|claude-4|claude-3-5|claude-3\.5/i,
    profile: {
      reasoning: true,
      note: "Claude extended thinking (off..high)",
    },
  },
  {
    pattern: /claude/i,
    profile: {
      reasoning: true,
      note: "Claude generic thinking",
    },
  },

  // —— Google Gemini (pi-ai google.json / vertex) ——
  {
    pattern: /gemini-3(\.[1-9])?-pro|gemini-3-pro/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: {
        off: null,
        minimal: null,
        low: "LOW",
        medium: null,
        high: "HIGH",
        xhigh: null,
        max: null,
      },
      note: "Gemini 3.x Pro: LOW / HIGH only (always-on base)",
    },
  },
  {
    pattern:
      /gemini-3(\.[0-9]+)?-?flash|gemini-3\.6|gemini-3\.5-flash|gemini-3-flash|gemini-flash-latest|gemini-flash-lite/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: ALWAYS_ON_MAP,
      note: "Gemini 3 Flash: thinking always on (no off)",
    },
  },
  {
    pattern: /gemini-2\.5-(pro|flash)|gemini-2\.5/i,
    profile: {
      reasoning: true,
      note: "Gemini 2.5: standard thinking levels",
    },
  },
  {
    pattern: /gemini-2\.0/i,
    profile: {
      reasoning: false,
      note: "Gemini 2.0 Flash: no extended thinking in catalog",
    },
  },
  {
    pattern: /gemini|gemma-4/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: ALWAYS_ON_MAP,
      note: "Gemini/Gemma generic thinking-class",
    },
  },

  // —— DeepSeek ——
  {
    pattern: /deepseek-v4|deepseek-r1|deepseek-reasoner/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: HIGH_MAX_MAP,
      note: "DeepSeek: high/max",
    },
  },
  {
    pattern: /deepseek/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: HIGH_MAX_MAP,
      note: "DeepSeek generic high/max",
    },
  },

  // —— 智谱 GLM ——
  {
    pattern: /glm-5\.2/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: HIGH_MAX_MAP,
      note: "GLM-5.2: high/max (pi-ai)",
    },
  },
  {
    pattern: /glm-5|glm-4\.7|glm-4\.6|thinking|glm-z1/i,
    profile: {
      reasoning: true,
      note: "GLM thinking-capable",
    },
  },

  // —— Qwen ——
  {
    pattern: /qwen3|qwq|qwen.*think/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: {
        off: "none",
        minimal: null,
        low: null,
        medium: null,
        high: "default",
        xhigh: null,
        max: null,
      },
      note: "Qwen thinking on/off style",
    },
  },

  // —— MiniMax ——
  {
    pattern: /minimax|m2\.|m3/i,
    profile: {
      reasoning: true,
      note: "MiniMax reasoning",
    },
  },
];

export function inferReasoningProfile(modelId: string): ReasoningProfile {
  const hit = lookupPiAiCatalog(modelId);
  if (hit) {
    return {
      reasoning: hit.reasoning,
      thinkingLevelMap: hit.thinkingLevelMap
        ? { ...hit.thinkingLevelMap }
        : undefined,
      note: `pi-ai:${hit.source} (${hit.matchedKey})`,
    };
  }
  for (const { pattern, profile } of PROFILES) {
    if (pattern.test(modelId)) {
      return {
        reasoning: profile.reasoning,
        thinkingLevelMap: profile.thinkingLevelMap
          ? { ...profile.thinkingLevelMap }
          : undefined,
        note: profile.note,
      };
    }
  }
  return { reasoning: false };
}

/**
 * Levels the user can pick.
 * Map semantics (pi docs):
 * - omitted key + no map → off..high
 * - omitted key when map exists → xhigh/max unsupported; others use provider default
 * - null → unsupported
 * - string → supported
 */
export function listSupportedThinkingLevels(opts: {
  reasoning: boolean;
  thinkingLevelMap?: ThinkingLevelMap;
}): ThinkingLevel[] {
  if (!opts.reasoning) return ["off"];
  const map = opts.thinkingLevelMap;
  if (!map) {
    return ["off", "minimal", "low", "medium", "high"];
  }
  return ALL_THINKING_LEVELS.filter((level) => {
    if (Object.prototype.hasOwnProperty.call(map, level)) {
      return map[level] !== null;
    }
    // omitted keys: xhigh/max unsupported by default; off..high use provider default
    if (level === "xhigh" || level === "max") return false;
    return true;
  });
}

export function formatThinkingSummary(opts: {
  modelId: string;
  reasoning: boolean;
  thinkingLevelMap?: ThinkingLevelMap;
  current?: string;
  note?: string;
}): string {
  const levels = listSupportedThinkingLevels(opts);
  const cur = opts.current ? ` 当前=${opts.current}` : "";
  const note = opts.note ? ` · ${opts.note}` : "";
  if (!opts.reasoning) {
    return `${opts.modelId}: 不支持思考（reasoning=false）${cur}`;
  }
  return `${opts.modelId}: 可用 [${levels.join(", ")}]${cur}${note}`;
}
