import { discoverModels } from "./discover.ts";
import type { ProviderApi } from "./types.ts";

export interface TestConnectionOptions {
  baseUrl: string;
  api: ProviderApi;
  apiKey?: string;
  modelId?: string;
}

function stripKey(msg: string, apiKey?: string): string {
  if (!apiKey) return msg;
  return msg.split(apiKey).join("***");
}

function chatUrl(baseUrl: string): string {
  const t = baseUrl.replace(/\/+$/, "");
  if (t.endsWith("/chat/completions")) return t;
  if (t.endsWith("/v1")) return `${t}/chat/completions`;
  return `${t}/v1/chat/completions`;
}

function messagesUrl(baseUrl: string): string {
  const t = baseUrl.replace(/\/+$/, "");
  if (t.endsWith("/messages")) return t;
  if (t.endsWith("/v1")) return `${t}/messages`;
  return `${t}/v1/messages`;
}

export async function testConnection(
  opts: TestConnectionOptions,
): Promise<{ ok: boolean; message: string }> {
  const discovered = await discoverModels({
    baseUrl: opts.baseUrl,
    api: opts.api,
    apiKey: opts.apiKey,
  });
  if (discovered.ok) {
    return {
      ok: true,
      message: `连通成功：发现 ${discovered.models.length} 个模型`,
    };
  }

  try {
    if (opts.api === "openai-completions") {
      const res = await fetch(chatUrl(opts.baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: opts.modelId ?? "dummy",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok || res.status === 400) {
        // 400 often means auth ok but bad model — still connectivity/auth signal
        return {
          ok: res.ok || res.status === 400,
          message: res.ok
            ? "连通成功（chat/completions）"
            : `端点可达（HTTP ${res.status}），请检查模型 id`,
        };
      }
      const body = (await res.text()).slice(0, 200);
      return {
        ok: false,
        message: stripKey(`HTTP ${res.status}: ${body}`, opts.apiKey),
      };
    }

    const res = await fetch(messagesUrl(opts.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.apiKey
          ? {
              "x-api-key": opts.apiKey,
              "anthropic-version": "2023-06-01",
            }
          : {}),
      },
      body: JSON.stringify({
        model: opts.modelId ?? "dummy",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok || res.status === 400) {
      return {
        ok: res.ok || res.status === 400,
        message: res.ok
          ? "连通成功（messages）"
          : `端点可达（HTTP ${res.status}），请检查模型 id`,
      };
    }
    const body = (await res.text()).slice(0, 200);
    return {
      ok: false,
      message: stripKey(`HTTP ${res.status}: ${body}`, opts.apiKey),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: stripKey(
        `发现失败: ${discovered.error}; 探测失败: ${msg}`,
        opts.apiKey,
      ),
    };
  }
}
