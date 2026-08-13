export type ProviderApi = "openai-completions" | "anthropic-messages";

export type KeyMode = "literal" | "env";

export interface CostConfig {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Pi thinking levels; null in map = unsupported for this model. */
export type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export type ThinkingLevelMap = Partial<Record<ThinkingLevel, string | null>>;

export interface ModelEntry {
  id: string;
  name: string;
  reasoning: boolean;
  /** Maps pi levels → provider values; omit for pi defaults when reasoning=true */
  thinkingLevelMap?: ThinkingLevelMap;
  input: Array<"text" | "image">;
  contextWindow: number;
  maxTokens: number;
  cost: CostConfig;
  api?: ProviderApi;
}

export interface ModelsProviderConfig {
  baseUrl?: string;
  api?: ProviderApi;
  apiKey?: string;
  authHeader?: boolean;
  headers?: Record<string, string>;
  models?: ModelEntry[];
  [key: string]: unknown;
}

export interface ModelsFile {
  providers?: Record<string, ModelsProviderConfig>;
  [key: string]: unknown;
}

export interface AuthApiKey {
  type: "api_key";
  key: string;
  env?: Record<string, string>;
}

export type AuthEntry = AuthApiKey | { type: string; [key: string]: unknown };

export type AuthFile = Record<string, AuthEntry>;

export interface SettingsFile {
  defaultProvider?: string;
  defaultModel?: string;
  [key: string]: unknown;
}

export interface ManagedProviderMeta {
  displayName: string;
  selectedModelIds: string[];
  api: ProviderApi;
  createdAt: string;
  updatedAt: string;
}

export interface SidecarFile {
  version: 1;
  managedProviders: string[];
  providers: Record<string, ManagedProviderMeta>;
  /** Last applied context-infer catalog version (from CONTEXT_CATALOG_VERSION). */
  contextCatalogVersion?: number;
  contextCatalogAppliedAt?: string;
  /** When true, check installed pi-ai data on session start and regen automatically. Default false. */
  autoRegenOnStart?: boolean;
}

export const DEFAULT_MODEL_META = {
  reasoning: false as const,
  input: ["text"] as Array<"text" | "image">,
  contextWindow: 128000,
  maxTokens: 16384,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

export const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9_-]*$/;

/** Common context window presets shown in /providers UI */
export const CONTEXT_WINDOW_PRESETS: Array<{ label: string; value: number }> = [
  { label: "128k (128000)", value: 128000 },
  { label: "200k (200000)", value: 200000 },
  { label: "256k (256000)", value: 256000 },
  { label: "1M (1000000)", value: 1000000 },
  { label: "2M (2000000)", value: 2000000 },
  { label: "自定义…", value: -1 },
];

export function applyContextWindow(models: ModelEntry[], contextWindow: number): ModelEntry[] {
  return models.map((m) => ({
    ...m,
    contextWindow,
    // keep existing maxTokens unless it absurdly exceeds the window
    maxTokens: Math.min(m.maxTokens || DEFAULT_MODEL_META.maxTokens, contextWindow),
  }));
}
