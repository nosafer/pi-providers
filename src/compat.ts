import type {
  ModelEntry,
  ModelsProviderConfig,
  ProviderApi,
  ProviderCompat,
} from "./types.ts";

export type { ProviderCompat };

export function asCompat(value: unknown): ProviderCompat | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as ProviderCompat;
}

export function inferGatewayCompat(baseUrl?: string): ProviderCompat | undefined {
  if (!baseUrl) return undefined;
  const host = hostnameOf(baseUrl);
  if (host === "sharellm.net" || host.endsWith(".sharellm.net")) {
    return { supportsDeveloperRole: false };
  }
  return undefined;
}

export function mergeCompat(
  base?: ProviderCompat,
  override?: ProviderCompat,
): ProviderCompat | undefined {
  if (!base && !override) return undefined;
  return { ...base, ...override };
}

export function resolveProviderCompat(
  baseUrl: string | undefined,
  existing?: ProviderCompat,
  explicit?: ProviderCompat,
): ProviderCompat | undefined {
  return mergeCompat(mergeCompat(inferGatewayCompat(baseUrl), existing), explicit);
}

export interface ManagedProviderRegistration {
  baseUrl: string;
  api: ProviderApi;
  models: Array<
    Pick<
      ModelEntry,
      | "id"
      | "name"
      | "reasoning"
      | "thinkingLevelMap"
      | "input"
      | "contextWindow"
      | "maxTokens"
      | "cost"
    > & { compat?: ProviderCompat }
  >;
}

/**
 * Build the registerProvider payload.
 * Extension models replace models.json models, so provider-level compat
 * must be copied onto each model or Pi will send role=developer.
 */
export function buildManagedProviderRegistration(
  p: ModelsProviderConfig,
): ManagedProviderRegistration {
  if (!p.baseUrl || !p.api) {
    throw new Error("provider config missing baseUrl or api");
  }
  const providerCompat = resolveProviderCompat(p.baseUrl, asCompat(p.compat));
  return {
    baseUrl: p.baseUrl,
    api: p.api,
    models: (p.models ?? []).map((m) => {
      const compat = mergeCompat(providerCompat, m.compat);
      return {
        id: m.id,
        name: m.name,
        reasoning: m.reasoning,
        thinkingLevelMap: m.thinkingLevelMap,
        input: m.input,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
        cost: m.cost,
        ...(compat ? { compat } : {}),
      };
    }),
  };
}

function hostnameOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return baseUrl.toLowerCase();
  }
}
