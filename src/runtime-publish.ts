import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ProviderApi } from "./types.ts";
import { loadAuth, loadModels } from "./store.ts";

/** Resolve key the same way commands do (auth.json or $ENV in models). */
export function resolveRuntimeApiKey(
  providerId: string,
  modelsApiKey: string | undefined,
): string | undefined {
  if (modelsApiKey?.startsWith("$")) {
    const envVar = modelsApiKey.slice(1).replace(/^\{|\}$/g, "");
    return process.env[envVar];
  }
  const auth = loadAuth();
  const entry = auth[providerId];
  if (entry && entry.type === "api_key" && typeof entry.key === "string") {
    if (entry.key.startsWith("$")) {
      const envVar = entry.key.slice(1).replace(/^\{|\}$/g, "");
      return process.env[envVar];
    }
    return entry.key;
  }
  return undefined;
}

/**
 * Hot-register managed provider so current session can use it without full process restart.
 * Still keeps models.json/auth.json as source of truth.
 */
export async function publishManagedProvider(
  pi: ExtensionAPI,
  modelRegistry: { refresh: () => Promise<void> },
  providerId: string,
): Promise<{ ok: boolean; message: string }> {
  const p = loadModels().providers?.[providerId];
  if (!p?.baseUrl || !p.api || !p.models?.length) {
    return { ok: false, message: `无法发布 ${providerId}：配置不完整` };
  }

  const apiKey = resolveRuntimeApiKey(providerId, p.apiKey);
  try {
    // Re-register replaces models for this provider in the live registry.
    pi.registerProvider(providerId, {
      baseUrl: p.baseUrl,
      api: p.api as ProviderApi,
      apiKey,
      models: p.models.map((m) => ({
        id: m.id,
        name: m.name,
        reasoning: m.reasoning,
        input: m.input,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
        cost: m.cost,
      })),
    });
    await modelRegistry.refresh();
    return { ok: true, message: `已热加载 ${providerId}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `热加载失败: ${msg}` };
  }
}
