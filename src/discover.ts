import {
  extractContextFromRow,
  resolveContextWindow,
} from "./context-infer.ts";
import { inferReasoningProfile } from "./reasoning-infer.ts";
import { DEFAULT_MODEL_META, type ModelEntry, type ProviderApi } from "./types.ts";

export function toModelEntry(
  id: string,
  name?: string,
  contextWindow?: number,
): ModelEntry {
  const cw = resolveContextWindow({
    id,
    fromApi: contextWindow,
    fallback: DEFAULT_MODEL_META.contextWindow,
  });
  const reasoning = inferReasoningProfile(id);
  return {
    id,
    name: name ?? id,
    reasoning: reasoning.reasoning,
    thinkingLevelMap: reasoning.thinkingLevelMap,
    input: [...DEFAULT_MODEL_META.input],
    contextWindow: cw,
    maxTokens: DEFAULT_MODEL_META.maxTokens,
    cost: { ...DEFAULT_MODEL_META.cost },
  };
}

export function normalizeModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/models")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/models`;
  return `${trimmed}/v1/models`;
}

function authHeaders(api: ProviderApi, apiKey?: string): Record<string, string> {
  if (!apiKey) return {};
  if (api === "anthropic-messages") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

export interface DiscoverOptions {
  baseUrl: string;
  api: ProviderApi;
  apiKey?: string;
  signal?: AbortSignal;
}

export type DiscoverResult =
  | { ok: true; models: ModelEntry[] }
  | { ok: false; error: string };

export async function discoverModels(opts: DiscoverOptions): Promise<DiscoverResult> {
  const url = normalizeModelsUrl(opts.baseUrl);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...authHeaders(opts.api, opts.apiKey),
      },
      signal: opts.signal ?? AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return { ok: false, error: `HTTP ${res.status}${body ? `: ${body}` : ""}` };
    }
    const json = (await res.json()) as unknown;
    const ids = extractModelIds(json);
    if (ids.length === 0) {
      return { ok: false, error: "模型列表为空或无法解析" };
    }
    return {
      ok: true,
      models: ids.map(({ id, name, contextWindow }) =>
        toModelEntry(id, name, contextWindow),
      ),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

function extractModelIds(
  json: unknown,
): Array<{ id: string; name?: string; contextWindow?: number }> {
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  const data = obj.data;
  const out: Array<{ id: string; name?: string; contextWindow?: number }> = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || !row.id) continue;
      out.push({
        id: row.id,
        name: typeof row.name === "string" ? row.name : undefined,
        contextWindow: extractContextFromRow(row),
      });
    }
    return out;
  }
  if (Array.isArray(obj.models)) {
    for (const item of obj.models) {
      if (typeof item === "string") {
        out.push({ id: item });
        continue;
      }
      if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
        const row = item as Record<string, unknown>;
        out.push({
          id: row.id as string,
          name: typeof row.name === "string" ? row.name : undefined,
          contextWindow: extractContextFromRow(row),
        });
      }
    }
    return out;
  }
  return out;
}
