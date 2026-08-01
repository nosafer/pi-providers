/**
 * Infer whether a model supports thinking/reasoning and which pi levels apply.
 *
 * Pi levels: off | minimal | low | medium | high | xhigh | max
 * - reasoning:false → effectively only off (UI hides thinking)
 * - reasoning:true without map → standard off..high (xhigh/max opt-in via map)
 * - thinkingLevelMap null = unsupported; string = supported + provider value
 *
 * Heuristics are gateway-oriented; apply-context / re-infer can refresh stored config.
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

/** Standard pi default when reasoning=true and no map: off..high */
export const STANDARD_THINKING_MAP: ThinkingLevelMap = {
  off: "off",
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: null,
  max: null,
};

/** OpenAI-style effort including extended */
export const OPENAI_EFFORT_MAP: ThinkingLevelMap = {
  off: "none",
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "max",
};

/** Anthropic-style (often no xhigh hole) */
export const ANTHROPIC_MAP: ThinkingLevelMap = {
  off: null, // some always-on; still allow off when provider supports
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: null,
  max: "max",
};

export interface ReasoningProfile {
  reasoning: boolean;
  thinkingLevelMap?: ThinkingLevelMap;
  note?: string;
}

const PROFILES: Array<{ pattern: RegExp; profile: ReasoningProfile }> = [
  // OpenAI GPT-5.x / o-series
  {
    pattern: /gpt-5|o3|o4-mini|o1/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: OPENAI_EFFORT_MAP,
      note: "OpenAI reasoning/effort",
    },
  },
  // xAI Grok 4.x — reasoning variants
  {
    pattern: /grok-4.*(reason|thinking)|grok-4\.5|grok-4\.3|grok-4\.20/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: {
        off: "off",
        minimal: null,
        low: "low",
        medium: "medium",
        high: "high",
        xhigh: null,
        max: null,
      },
      note: "xAI Grok 4.x (gateway-dependent)",
    },
  },
  {
    pattern: /grok/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: STANDARD_THINKING_MAP,
      note: "Grok generic",
    },
  },
  // Anthropic
  {
    pattern: /claude-(opus|sonnet|haiku)-4|claude-3\.7|claude-4/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: ANTHROPIC_MAP,
      note: "Anthropic extended thinking",
    },
  },
  // Google Gemini thinking / high
  {
    pattern: /gemini-.*(thinking|high|pro)|gemini-2\.5|gemini-3/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: STANDARD_THINKING_MAP,
      note: "Gemini thinking-class",
    },
  },
  // DeepSeek R1 / reasoner
  {
    pattern: /deepseek-r1|deepseek-reasoner|reasoner/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: {
        off: null,
        minimal: null,
        low: null,
        medium: "default",
        high: "default",
        xhigh: null,
        max: null,
      },
      note: "DeepSeek reasoner (often always-on)",
    },
  },
  // 智谱 GLM thinking / 5.x
  {
    pattern: /glm-5|glm-4\.7|glm-4\.6|thinking|glm-z1/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: STANDARD_THINKING_MAP,
      note: "GLM / thinking variants",
    },
  },
  // Kimi / Moonshot k2 / k1.5 thinking
  {
    pattern: /kimi|moonshot|k1\.5|k2|k3/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: {
        off: "off",
        minimal: null,
        low: "low",
        medium: "medium",
        high: "high",
        xhigh: null,
        max: null,
      },
      note: "Kimi/Moonshot (gateway-dependent)",
    },
  },
  // Qwen thinking / qwq
  {
    pattern: /qwen3|qwq|qwen.*think/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: STANDARD_THINKING_MAP,
      note: "Qwen thinking-class",
    },
  },
  // MiniMax
  {
    pattern: /minimax|m1/i,
    profile: {
      reasoning: true,
      thinkingLevelMap: STANDARD_THINKING_MAP,
      note: "MiniMax",
    },
  },
];

export function inferReasoningProfile(modelId: string): ReasoningProfile {
  for (const { pattern, profile } of PROFILES) {
    if (pattern.test(modelId)) return { ...profile, thinkingLevelMap: profile.thinkingLevelMap ? { ...profile.thinkingLevelMap } : undefined };
  }
  return { reasoning: false };
}

/** Levels the user can pick for this model (null map entries hidden). */
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
      // omitted: standard through high; xhigh/max unsupported when map present without them
      if (level === "xhigh" || level === "max") return false;
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
}): string {
  const levels = listSupportedThinkingLevels(opts);
  const cur = opts.current ? ` 当前=${opts.current}` : "";
  if (!opts.reasoning) {
    return `${opts.modelId}: 不支持思考（reasoning=false）${cur}`;
  }
  return `${opts.modelId}: 可用 [${levels.join(", ")}]${cur}`;
}
