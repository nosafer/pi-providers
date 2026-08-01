export type ProviderApi = "openai-completions" | "anthropic-messages";

export type KeyMode = "literal" | "env";

export interface CostConfig {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ModelEntry {
  id: string;
  name: string;
  reasoning: boolean;
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
}

export const DEFAULT_MODEL_META = {
  reasoning: false as const,
  input: ["text"] as Array<"text" | "image">,
  contextWindow: 128000,
  maxTokens: 16384,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

export const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
