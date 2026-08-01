import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { discoverModels, toModelEntry } from "./discover.ts";
import {
  formatMultiSelectLabels,
  parseMultiSelectChoice,
  toggleMultiSelectState,
} from "./multi-select.ts";
import { planRefresh, applyRefreshSelection } from "./refresh-models.ts";
import {
  deleteManagedProvider,
  isManaged,
  listManaged,
  loadAuth,
  loadModels,
  loadSidecar,
  setDefaultModel,
  upsertManagedProvider,
} from "./store.ts";
import { resolveContextWindow } from "./context-infer.ts";
import { publishManagedProvider } from "./runtime-publish.ts";
import { selectScrollable } from "./select-ui.ts";
import { switchModel } from "./switch-model.ts";
import { testConnection } from "./test-connection.ts";
import type { KeyMode, ModelEntry, ProviderApi } from "./types.ts";
import {
  applyContextWindow,
  CONTEXT_WINDOW_PRESETS,
  PROVIDER_ID_RE,
} from "./types.ts";

type Ctx = ExtensionCommandContext;

async function pickContextWindow(ctx: Ctx, current = 128000): Promise<number | null> {
  const labels = CONTEXT_WINDOW_PRESETS.map((p) =>
    p.value === current ? `${p.label}  ← 当前` : p.label,
  );
  const choice = await selectScrollable(
    ctx,
    `上下文窗口 contextWindow（当前 ${current}）`,
    labels,
  );
  if (!choice) return null;
  const preset = CONTEXT_WINDOW_PRESETS.find((p) => choice.startsWith(p.label));
  if (!preset) return null;
  if (preset.value === -1) {
    const raw = (await ctx.ui.input("自定义 contextWindow（token 数）", String(current)))?.trim();
    if (!raw) return null;
    const n = Number(raw.replace(/[_,\s]/g, ""));
    if (!Number.isFinite(n) || n < 1000) {
      ctx.ui.notify("无效的 contextWindow", "error");
      return null;
    }
    return Math.floor(n);
  }
  return preset.value;
}

async function pickModels(
  ctx: Ctx,
  ids: string[],
  initial: string[],
  title = "选择模型",
): Promise<string[] | null> {
  let selected = new Set(initial);
  while (true) {
    const labels = formatMultiSelectLabels(ids, selected);
    // SelectList: maxVisible rows + auto scroll with cursor (fixes non-scrolling ctx.ui.select)
    const choice = await selectScrollable(
      ctx,
      `${title}（已选 ${selected.size}）  空格/回车切换勾选`,
      labels,
      14,
    );
    if (!choice) return null;
    const parsed = parseMultiSelectChoice(choice);
    if (parsed === "cancel") return null;
    if (parsed === "done") return [...selected];
    if (parsed === "sep") continue;
    selected = toggleMultiSelectState(selected, parsed.id);
  }
}

function resolveApiKey(
  providerId: string,
  modelsApiKey: string | undefined,
): { key?: string; mode: KeyMode; envVar?: string } {
  if (modelsApiKey?.startsWith("$")) {
    const envVar = modelsApiKey.slice(1).replace(/^\{|\}$/g, "");
    return { key: process.env[envVar], mode: "env", envVar };
  }
  const auth = loadAuth();
  const entry = auth[providerId];
  if (entry && entry.type === "api_key" && typeof entry.key === "string") {
    if (entry.key.startsWith("$")) {
      const envVar = entry.key.slice(1).replace(/^\{|\}$/g, "");
      return { key: process.env[envVar], mode: "env", envVar };
    }
    return { key: entry.key, mode: "literal" };
  }
  return { mode: "literal" };
}

async function actionList(ctx: Ctx): Promise<void> {
  const ids = listManaged();
  if (ids.length === 0) {
    ctx.ui.notify("尚无 pi-providers 管理的 provider。用 add 添加。", "info");
    return;
  }
  const models = loadModels();
  const side = loadSidecar();
  const current = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "(none)";
  const lines = ids.map((id) => {
    const p = models.providers?.[id];
    const meta = side.providers[id];
    const n = p?.models?.length ?? 0;
    const cur = ctx.model?.provider === id ? " [当前]" : "";
    return `${id}  ${meta?.api ?? p?.api ?? "?"}  models:${n}  ${p?.baseUrl ?? ""}${cur}`;
  });
  lines.push(`--- 当前会话: ${current}`);
  await selectScrollable(ctx, "Managed providers", lines);
}

async function actionAdd(ctx: Ctx, pi: ExtensionAPI): Promise<void> {
  const id = (await ctx.ui.input("Provider id (a-z0-9_-)"))?.trim();
  if (!id) return;
  if (!PROVIDER_ID_RE.test(id)) {
    ctx.ui.notify(`非法 id: ${id}`, "error");
    return;
  }
  if (isManaged(id)) {
    ctx.ui.notify(`已存在 managed provider: ${id}，请用 edit`, "error");
    return;
  }
  const models = loadModels();
  if (models.providers?.[id]) {
    ctx.ui.notify(`id 已被非本插件 provider 占用: ${id}`, "error");
    return;
  }

  const baseUrl = (await ctx.ui.input("baseUrl", "https://"))?.trim();
  if (!baseUrl) return;

  const apiLabel = await selectScrollable(ctx, "API 类型", [
    "openai-completions",
    "anthropic-messages",
  ]);
  if (!apiLabel) return;
  const api = apiLabel as ProviderApi;

  const keyModeLabel = await selectScrollable(ctx, "密钥方式", [
    "literal — 写入 auth.json",
    "env — models.json 引用 $ENV",
  ]);
  if (!keyModeLabel) return;
  const keyMode: KeyMode = keyModeLabel.startsWith("env") ? "env" : "literal";

  let apiKey: string | undefined;
  let envVar: string | undefined;
  if (keyMode === "literal") {
    apiKey = (await ctx.ui.input("API Key（不会显示完整日志）"))?.trim();
    if (!apiKey) {
      ctx.ui.notify("需要 API Key", "error");
      return;
    }
  } else {
    envVar = (await ctx.ui.input("环境变量名（不含 $）", "MY_API_KEY"))?.trim();
    if (!envVar) return;
    envVar = envVar.replace(/^\$/, "");
    apiKey = process.env[envVar];
  }

  let selectedModels: ModelEntry[] = [];
  const discovered = await discoverModels({ baseUrl, api, apiKey });
  if (discovered.ok) {
    const picked = await pickModels(
      ctx,
      discovered.models.map((m) => m.id),
      [],
      "多选要保留的模型",
    );
    if (picked === null) return;
    if (picked.length === 0) {
      const manual = (await ctx.ui.input("手填模型 id（逗号分隔）"))?.trim();
      if (manual) {
        selectedModels = manual
          .split(/[,\s]+/)
          .filter(Boolean)
          .map((x) => toModelEntry(x));
      }
    } else {
      const map = new Map(discovered.models.map((m) => [m.id, m]));
      selectedModels = picked.map((id) => map.get(id) ?? toModelEntry(id));
    }
  } else {
    ctx.ui.notify(`自动发现失败: ${discovered.error}，请手填模型`, "warning");
    const manual = (await ctx.ui.input("手填模型 id（逗号分隔）"))?.trim();
    if (!manual) {
      ctx.ui.notify("未选择模型，已取消", "error");
      return;
    }
    selectedModels = manual
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((x) => toModelEntry(x));
  }

  if (selectedModels.length === 0) {
    ctx.ui.notify("至少需要一个模型", "error");
    return;
  }

  // 优先使用接口字段 / 模型名启发式的各自 contextWindow（可能模型间不同）
  const sample = selectedModels
    .slice(0, 5)
    .map((m) => `${m.id}:${Math.round(m.contextWindow / 1000)}k`)
    .join(", ");
  ctx.ui.notify(`已推断上下文: ${sample}${selectedModels.length > 5 ? "…" : ""}`, "info");

  const override = await ctx.ui.confirm(
    "上下文窗口",
    "是否统一覆盖为同一 contextWindow？\n（选「否」则各模型保留自动推断值，推荐）",
  );
  if (override) {
    const avg =
      selectedModels.reduce((s, m) => s + m.contextWindow, 0) /
        selectedModels.length || 128000;
    const contextWindow = await pickContextWindow(ctx, Math.round(avg));
    if (contextWindow === null) return;
    selectedModels = applyContextWindow(selectedModels, contextWindow);
  }

  const doTest = await ctx.ui.confirm("连通测试", "现在测试连通性？");
  if (doTest) {
    const t = await testConnection({
      baseUrl,
      api,
      apiKey,
      modelId: selectedModels[0]?.id,
    });
    ctx.ui.notify(t.message, t.ok ? "info" : "warning");
  }

  upsertManagedProvider({
    id,
    displayName: id,
    baseUrl,
    api,
    keyMode,
    apiKey,
    envVar,
    models: selectedModels,
  });
  const published = await publishManagedProvider(pi, ctx.modelRegistry, id);
  if (!published.ok) {
    ctx.ui.notify(published.message, "warning");
  }
  ctx.ui.notify(`已添加 ${id}（${selectedModels.length} 模型）`, "info");

  const goSwitch = await ctx.ui.confirm(
    "切换模型",
    `立即切换到 ${id}/${selectedModels[0].id}？`,
  );
  if (goSwitch) {
    const scope = await selectScrollable(ctx, "范围", ["仅本次", "设为默认"]);
    if (scope) {
      const result = await switchModel({
        providerId: id,
        modelId: selectedModels[0].id,
        setAsDefault: scope === "设为默认",
        pi: { setModel: (m) => pi.setModel(m as never) },
        modelRegistry: {
          refresh: () => ctx.modelRegistry.refresh(),
          find: (p, mid) => ctx.modelRegistry.find(p, mid),
        },
        setDefault: (p, m) => setDefaultModel(p, m),
      });
      ctx.ui.notify(result.message, result.ok ? "info" : "error");
    }
  }
}

async function selectManaged(ctx: Ctx, title: string): Promise<string | null> {
  const ids = listManaged();
  if (ids.length === 0) {
    ctx.ui.notify("没有 managed provider", "info");
    return null;
  }
  return selectScrollable(ctx, title, ids);
}

async function actionEdit(ctx: Ctx, pi: ExtensionAPI): Promise<void> {
  const id = await selectManaged(ctx, "编辑哪个 provider？");
  if (!id) return;
  const models = loadModels();
  const p = models.providers?.[id];
  const side = loadSidecar();
  const meta = side.providers[id];
  if (!p || !meta) {
    ctx.ui.notify("数据不一致", "error");
    return;
  }

  const field = await selectScrollable(ctx, "改什么？", [
    "baseUrl",
    "api",
    "key",
    "contextWindow（上下文窗口）",
    "删除模型（从 /model 移除）",
    "models (手填覆盖)",
    "refresh 模型列表",
    "按官方启发式重算 context",
  ]);
  if (!field) return;

  if (field === "refresh 模型列表") {
    await actionRefresh(ctx, pi, id);
    return;
  }

  if (field === "删除模型（从 /model 移除）") {
    await actionRemoveModels(ctx, pi, id);
    return;
  }

  if (field === "按官方启发式重算 context") {
    await actionReinferContext(ctx, pi, id);
    return;
  }

  let baseUrl = p.baseUrl ?? "";
  let api = (p.api ?? meta.api) as ProviderApi;
  let keyMode: KeyMode = p.apiKey?.startsWith("$") ? "env" : "literal";
  let apiKey: string | undefined;
  let envVar: string | undefined;
  let modelList = [...(p.models ?? [])];

  if (field === "baseUrl") {
    baseUrl = (await ctx.ui.input("baseUrl", baseUrl))?.trim() || baseUrl;
  } else if (field === "api") {
    const a = await selectScrollable(ctx, "API", [
      "openai-completions",
      "anthropic-messages",
    ]);
    if (!a) return;
    api = a as ProviderApi;
  } else if (field === "key") {
    const mode = await selectScrollable(ctx, "密钥方式", [
      "literal — auth.json",
      "env — $ENV",
    ]);
    if (!mode) return;
    keyMode = mode.startsWith("env") ? "env" : "literal";
    if (keyMode === "literal") {
      apiKey = (await ctx.ui.input("API Key"))?.trim();
      if (!apiKey) return;
    } else {
      envVar = (await ctx.ui.input("环境变量名", "MY_API_KEY"))?.trim()?.replace(/^\$/, "");
      if (!envVar) return;
    }
  } else if (field === "contextWindow（上下文窗口）") {
    const current = modelList[0]?.contextWindow ?? 128000;
    const cw = await pickContextWindow(ctx, current);
    if (cw === null) return;
    modelList = applyContextWindow(modelList, cw);
  } else if (field === "models (手填覆盖)") {
    const cur = modelList.map((m) => m.id).join(", ");
    const manual = (await ctx.ui.input("模型 id（逗号分隔）", cur))?.trim();
    if (!manual) return;
    const currentCw = modelList[0]?.contextWindow ?? 128000;
    modelList = applyContextWindow(
      manual
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((x) => toModelEntry(x)),
      currentCw,
    );
  }

  if (field !== "key") {
    const resolved = resolveApiKey(id, p.apiKey);
    keyMode = resolved.mode;
    if (keyMode === "env") envVar = resolved.envVar;
    else apiKey = resolved.key;
  }

  upsertManagedProvider({
    id,
    displayName: id,
    baseUrl,
    api,
    keyMode,
    apiKey,
    envVar,
    models: modelList,
  });
  const published = await publishManagedProvider(pi, ctx.modelRegistry, id);
  if (!published.ok) ctx.ui.notify(published.message, "warning");
  ctx.ui.notify(`已更新 ${id}`, "info");
}

/** Remove selected model ids from a managed provider so they disappear from /model. */
async function actionRemoveModels(
  ctx: Ctx,
  pi: ExtensionAPI,
  presetId?: string,
): Promise<void> {
  const id = presetId ?? (await selectManaged(ctx, "从哪个 provider 删除模型？"));
  if (!id) return;
  const modelsFile = loadModels();
  const p = modelsFile.providers?.[id];
  const meta = loadSidecar().providers[id];
  if (!p?.models?.length || !meta) {
    ctx.ui.notify("没有可删的模型", "info");
    return;
  }

  const picked = await pickModels(
    ctx,
    p.models.map((m) => m.id),
    [],
    "勾选要删除的模型（Done 确认删除）",
  );
  if (picked === null) return;
  if (picked.length === 0) {
    ctx.ui.notify("未勾选任何模型", "info");
    return;
  }

  const remove = new Set(picked);
  const remaining = p.models.filter((m) => !remove.has(m.id));
  if (remaining.length === 0) {
    const ok = await ctx.ui.confirm(
      "无剩余模型",
      "全部模型都勾选了。是否直接删除整个 provider？",
    );
    if (ok) {
      deleteManagedProvider(id);
      try {
        pi.unregisterProvider(id);
      } catch {
        // registry may not have it registered yet
      }
      await ctx.modelRegistry.refresh();
      ctx.ui.notify(`已删除 provider ${id}`, "info");
    }
    return;
  }

  const ok = await ctx.ui.confirm(
    "确认删除",
    `将从 ${id} 移除 ${picked.length} 个模型，之后 /model 不再显示它们。`,
  );
  if (!ok) return;

  const resolved = resolveApiKey(id, p.apiKey);
  const keyMode: KeyMode = p.apiKey?.startsWith("$") ? "env" : "literal";
  upsertManagedProvider({
    id,
    displayName: id,
    baseUrl: p.baseUrl ?? "",
    api: (p.api ?? meta.api) as ProviderApi,
    keyMode,
    apiKey: keyMode === "literal" ? resolved.key : undefined,
    envVar: keyMode === "env" ? resolved.envVar : undefined,
    models: remaining,
  });
  const published = await publishManagedProvider(pi, ctx.modelRegistry, id);
  if (!published.ok) ctx.ui.notify(published.message, "warning");
  ctx.ui.notify(`已移除 ${picked.join(", ")}，剩余 ${remaining.length} 个`, "info");
}

async function actionReinferContext(
  ctx: Ctx,
  pi: ExtensionAPI,
  presetId?: string,
): Promise<void> {
  const id = presetId ?? (await selectManaged(ctx, "重算哪个 provider 的 context？"));
  if (!id) return;
  const p = loadModels().providers?.[id];
  const meta = loadSidecar().providers[id];
  if (!p?.models?.length || !meta) return;

  const updated = p.models.map((m) => ({
    ...m,
    contextWindow: resolveContextWindow({ id: m.id }),
  }));
  const summary = updated
    .slice(0, 8)
    .map((m) => `${m.id}:${Math.round(m.contextWindow / 1000)}k`)
    .join(", ");
  const ok = await ctx.ui.confirm("重算 context", `将应用：\n${summary}`);
  if (!ok) return;

  const resolved = resolveApiKey(id, p.apiKey);
  const keyMode: KeyMode = p.apiKey?.startsWith("$") ? "env" : "literal";
  upsertManagedProvider({
    id,
    displayName: id,
    baseUrl: p.baseUrl ?? "",
    api: (p.api ?? meta.api) as ProviderApi,
    keyMode,
    apiKey: keyMode === "literal" ? resolved.key : undefined,
    envVar: keyMode === "env" ? resolved.envVar : undefined,
    models: updated,
  });
  const published = await publishManagedProvider(pi, ctx.modelRegistry, id);
  if (!published.ok) ctx.ui.notify(published.message, "warning");
  ctx.ui.notify("已按官方启发式更新 contextWindow", "info");
}

async function actionDelete(ctx: Ctx): Promise<void> {
  const id = await selectManaged(ctx, "删除哪个 provider？");
  if (!id) return;
  const ok = await ctx.ui.confirm("确认删除", `删除 managed provider「${id}」？`);
  if (!ok) return;
  deleteManagedProvider(id);
  await ctx.modelRegistry.refresh();
  ctx.ui.notify(`已删除 ${id}`, "info");
}

async function actionRefresh(ctx: Ctx, pi: ExtensionAPI, presetId?: string): Promise<void> {
  const id = presetId ?? (await selectManaged(ctx, "刷新哪个 provider 的模型？"));
  if (!id) return;
  const modelsFile = loadModels();
  const p = modelsFile.providers?.[id];
  const side = loadSidecar();
  const meta = side.providers[id];
  if (!p || !meta) {
    ctx.ui.notify("数据不一致", "error");
    return;
  }
  const resolved = resolveApiKey(id, p.apiKey);
  const discovered = await discoverModels({
    baseUrl: p.baseUrl ?? "",
    api: (p.api ?? meta.api) as ProviderApi,
    apiKey: resolved.key,
  });
  if (!discovered.ok) {
    ctx.ui.notify(`刷新失败: ${discovered.error}`, "error");
    return;
  }
  const selected = meta.selectedModelIds;
  const plan = planRefresh(
    selected,
    discovered.models.map((m) => m.id),
  );
  if (plan.stale.length) {
    ctx.ui.notify(`远端已无: ${plan.stale.join(", ")}（本地仍保留）`, "warning");
  }
  let added: string[] = [];
  if (plan.newCandidates.length) {
    const picked = await pickModels(
      ctx,
      plan.newCandidates,
      [],
      "远端新增模型 — 选择加入",
    );
    if (picked === null) return;
    added = picked;
  } else {
    ctx.ui.notify("无新增模型", "info");
  }

  const finalModels = applyRefreshSelection({
    keep: plan.keep,
    added,
    stale: plan.stale,
    remoteModels: discovered.models,
    localModels: p.models ?? [],
  });

  const keyMode: KeyMode = p.apiKey?.startsWith("$") ? "env" : "literal";
  upsertManagedProvider({
    id,
    displayName: id,
    baseUrl: p.baseUrl ?? "",
    api: (p.api ?? meta.api) as ProviderApi,
    keyMode,
    apiKey: keyMode === "literal" ? resolved.key : undefined,
    envVar: keyMode === "env" ? resolved.envVar : undefined,
    models: finalModels,
  });
  const published = await publishManagedProvider(pi, ctx.modelRegistry, id);
  if (!published.ok) ctx.ui.notify(published.message, "warning");
  ctx.ui.notify(
    `刷新完成：保留 ${plan.keep.length}，新增 ${added.length}，stale ${plan.stale.length}`,
    "info",
  );
}

async function actionSwitch(ctx: Ctx, pi: ExtensionAPI): Promise<void> {
  const id = await selectManaged(ctx, "切换到哪个 provider？");
  if (!id) return;
  const models = loadModels().providers?.[id]?.models ?? [];
  if (models.length === 0) {
    ctx.ui.notify("该 provider 无模型", "error");
    return;
  }
  const modelId = await selectScrollable(
    ctx,
    "选择模型",
    models.map((m) => m.id),
  );
  if (!modelId) return;
  const scope = await selectScrollable(ctx, "范围", ["仅本次", "设为默认"]);
  if (!scope) return;
  // Ensure live registry has this provider before setModel
  await publishManagedProvider(pi, ctx.modelRegistry, id);
  const result = await switchModel({
    providerId: id,
    modelId,
    setAsDefault: scope === "设为默认",
    pi: { setModel: (m) => pi.setModel(m as never) },
    modelRegistry: {
      refresh: () => ctx.modelRegistry.refresh(),
      find: (p, mid) => ctx.modelRegistry.find(p, mid),
    },
    setDefault: (p, m) => setDefaultModel(p, m),
  });
  ctx.ui.notify(result.message, result.ok ? "info" : "error");
}

async function actionTest(ctx: Ctx): Promise<void> {
  const id = await selectManaged(ctx, "测试哪个 provider？");
  if (!id) return;
  const p = loadModels().providers?.[id];
  const meta = loadSidecar().providers[id];
  if (!p) return;
  const resolved = resolveApiKey(id, p.apiKey);
  const t = await testConnection({
    baseUrl: p.baseUrl ?? "",
    api: (p.api ?? meta?.api ?? "openai-completions") as ProviderApi,
    apiKey: resolved.key,
    modelId: p.models?.[0]?.id,
  });
  ctx.ui.notify(t.message, t.ok ? "info" : "error");
}

export function registerProvidersCommand(pi: ExtensionAPI): void {
  pi.registerCommand("providers", {
    description: "管理自建/第三方模型中转 (pi-providers)",
    getArgumentCompletions: (prefix) => {
      const subs = [
        "list",
        "add",
        "edit",
        "delete-models",
        "delete",
        "refresh",
        "switch",
        "test",
      ];
      return subs
        .filter((s) => s.startsWith(prefix))
        .map((s) => ({ value: s, label: s }));
    },
    handler: async (args, ctx) => {
      const sub = args.trim().split(/\s+/).filter(Boolean)[0] ?? "";
      try {
        if (!sub || sub === "list") {
          if (!sub) {
            const action = await selectScrollable(ctx, "/providers", [
              "list",
              "add",
              "edit",
              "delete-models",
              "delete",
              "refresh",
              "switch",
              "test",
            ]);
            if (!action) return;
            return handlerRoute(action, ctx, pi);
          }
          return actionList(ctx);
        }
        return handlerRoute(sub, ctx, pi);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(msg, "error");
      }
    },
  });
}

async function handlerRoute(sub: string, ctx: Ctx, pi: ExtensionAPI): Promise<void> {
  switch (sub) {
    case "list":
      return actionList(ctx);
    case "add":
      return actionAdd(ctx, pi);
    case "edit":
      return actionEdit(ctx, pi);
    case "delete-models":
      return actionRemoveModels(ctx, pi);
    case "delete":
      return actionDelete(ctx);
    case "refresh":
      return actionRefresh(ctx, pi);
    case "switch":
      return actionSwitch(ctx, pi);
    case "test":
      return actionTest(ctx);
    default:
      ctx.ui.notify(`未知子命令: ${sub}`, "error");
  }
}
