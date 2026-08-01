/**
 * Infer reasoning + thinkingLevelMap aligned with pi-ai official provider catalogs
 * and vendor docs (Moonshot K3: reasoning_effort low/high/max, default max).
 *
 * Source of truth cross-check (pi-ai dist/providers/data/* + Moonshot docs 2026-08):
 * - kimi-k3: off=null, low/high/max (medium/minimal/xhigh null)
 * - grok-4.5: off=null, low/medium/high (no max/xhigh)
 * - gpt-5.5: off=null, low..xhigh (no max on 5.5; 5.6 sol/terra/luna include max)
 * - deepseek-v4 / glm-5.2: high + max
 * - gemini-3 flash: always-on thinking (off=null only)
 */

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

  // —— Anthropic Claude ——
  {
    pattern: /claude-opus-4-[678]|claude-opus-5|claude-sonnet-5|claude-fable/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: CLAUDE_XHIGH_MAX_MAP,
      note: "Claude adaptive + xhigh/max",
    },
  },
  {
    pattern: /claude-(opus|sonnet)-4-6|claude-sonnet-4-6/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: CLAUDE_MAX_MAP,
      note: "Claude 4.6 + max",
    },
  },
  {
    pattern: /claude/i,
    profile: {
      reasoning: true,
      note: "Claude extended thinking (standard levels)",
    },
  },

  // —— Google Gemini ——
  {
    pattern: /gemini-3\.[1-9]-pro|gemini-3-pro/i,
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
      note: "Gemini 3 Pro: LOW/HIGH",
    },
  },
  {
    pattern: /gemini-3|gemini-2\.5|gemini-flash/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: ALWAYS_ON_MAP,
      note: "Gemini flash: thinking always on",
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
    if (!(level in map)) {
      if (level === "xhigh" || level === "max") return false;
      // When map only sets max (Claude), off..high still available unless null
      if (Object.keys(map).length <= 2 && (map.max !== undefined || map.xhigh !== undefined)) {
        return level !== "xhigh" && level !== "max" ? true : map[level] != null;
      }
      return true;
    }
    return map[level] !== null;
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
