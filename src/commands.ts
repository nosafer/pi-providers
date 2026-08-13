import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { discoverModels, toModelEntry } from "./discover.ts";
import {
  formatMultiSelectLabels,
  parseMultiSelectChoice,
  toggleMultiSelectState,
} from "./multi-select.ts";
import { planRefresh, applyRefreshSelection } from "./refresh-models.ts";
import { maybeAutoRegenCatalog } from "./regen-catalog.ts";
import {
  deleteManagedProvider,
  isManaged,
  listManaged,
  loadAuth,
  loadModels,
  loadSidecar,
  saveSidecar,
  setDefaultModel,
  upsertManagedProvider,
} from "./store.ts";
import {
  CONTEXT_CATALOG_VERSION,
  getCatalogLabel,
  resolveContextWindow,
} from "./context-infer.ts";
import {
  formatThinkingSummary,
  inferReasoningProfile,
  listSupportedThinkingLevels,
  type ThinkingLevel,
} from "./reasoning-infer.ts";
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

function previewReinfer(providerId: string): {
  changed: number;
  summary: string;
  updated: ModelEntry[];
} | null {
  const p = loadModels().providers?.[providerId];
  if (!p?.models?.length) return null;
  let changed = 0;
  const updated = p.models.map((m) => {
    const nextCw = resolveContextWindow({ id: m.id });
    const reason = inferReasoningProfile(m.id);
    if (
      nextCw !== m.contextWindow ||
      reason.reasoning !== m.reasoning ||
      JSON.stringify(reason.thinkingLevelMap ?? null) !==
        JSON.stringify(m.thinkingLevelMap ?? null)
    ) {
      changed += 1;
    }
    return {
      ...m,
      contextWindow: nextCw,
      reasoning: reason.reasoning,
      thinkingLevelMap: reason.thinkingLevelMap,
    };
  });
  const summary = updated
    .map(
      (m) =>
        `${m.id}:${Math.round(m.contextWindow / 1000)}k${m.reasoning ? "+think" : ""}`,
    )
    .join(", ");
  return { changed, summary, updated };
}

function writeReinfer(providerId: string, updated: ModelEntry[]): void {
  const p = loadModels().providers?.[providerId];
  const meta = loadSidecar().providers[providerId];
  if (!p || !meta) return;
  const resolved = resolveApiKey(providerId, p.apiKey);
  const keyMode: KeyMode = p.apiKey?.startsWith("$") ? "env" : "literal";
  upsertManagedProvider({
    id: providerId,
    displayName: providerId,
    baseUrl: p.baseUrl ?? "",
    api: (p.api ?? meta.api) as ProviderApi,
    keyMode,
    apiKey: keyMode === "literal" ? resolved.key : undefined,
    envVar: keyMode === "env" ? resolved.envVar : undefined,
    models: updated,
  });
}

async function actionReinferContext(
  ctx: Ctx,
  pi: ExtensionAPI,
  presetId?: string,
): Promise<void> {
  const id = presetId ?? (await selectManaged(ctx, "重算哪个 provider 的 context？"));
  if (!id) return;
  const preview = previewReinfer(id);
  if (!preview) {
    ctx.ui.notify("没有可更新的模型", "info");
    return;
  }
  const ok = await ctx.ui.confirm("重算 context", `将应用：\n${preview.summary}`);
  if (!ok) return;
  writeReinfer(id, preview.updated);
  const published = await publishManagedProvider(pi, ctx.modelRegistry, id);
  if (!published.ok) ctx.ui.notify(published.message, "warning");
  ctx.ui.notify(`已更新（变更 ${preview.changed} 个模型）`, "info");
}

/**
 * One-click: apply latest built-in context catalog to ALL managed providers.
 * Use after plugin updates when context heuristics change.
 */
async function actionApplyLatestContextCatalog(
  ctx: Ctx,
  pi: ExtensionAPI,
): Promise<void> {
  // Auto-regenerate the catalog from installed pi-ai data if it changed
  // since we last wrote it (pi upgrade scenario). No-op when data is
  // unchanged or pi-ai data cannot be located.
  const regenNote = maybeAutoRegenCatalog();
  if (regenNote) ctx.ui.notify(regenNote, "info");

  const side = loadSidecar();
  const current = side.contextCatalogVersion ?? 0;
  const ids = listManaged();
  if (ids.length === 0) {
    ctx.ui.notify("没有 managed provider", "info");
    return;
  }

  const previewLines: string[] = [];
  let totalChanged = 0;
  for (const id of ids) {
    const p = loadModels().providers?.[id];
    if (!p?.models?.length) continue;
    const parts: string[] = [];
    for (const m of p.models) {
      const next = resolveContextWindow({ id: m.id });
      if (next !== m.contextWindow) {
        totalChanged += 1;
        parts.push(
          `${m.id} ${Math.round(m.contextWindow / 1000)}k→${Math.round(next / 1000)}k`,
        );
      }
    }
    if (parts.length) previewLines.push(`${id}: ${parts.join(", ")}`);
  }

  // Also count reasoning/thinking map drift in preview
  for (const id of ids) {
    const p = previewReinfer(id);
    if (p && p.changed > totalChanged) {
      // keep max of context-only count vs full reinfer count for message
      totalChanged = Math.max(totalChanged, p.changed);
    }
  }

  const header =
    current === CONTEXT_CATALOG_VERSION
      ? `当前已是 ${getCatalogLabel()}。仍可强制重算 context+思考能力。`
      : `当前 catalog: v${current || "未记录"} → 将应用 ${getCatalogLabel()}（含思考能力启发式）`;

  if (totalChanged === 0) {
    const ok = await ctx.ui.confirm(
      "同步最新能力表",
      `${header}\n预览：无变化（${ids.length} 个 provider）。\n仍写入 catalog 版本标记？`,
    );
    if (!ok) return;
  } else {
    const body = previewLines.slice(0, 12).join("\n");
    const more = previewLines.length > 12 ? `\n…共约 ${totalChanged} 处变更` : "";
    const ok = await ctx.ui.confirm(
      "同步最新能力表",
      `${header}\n\n${body || "(含 context + 思考强度表更新)"}${more}\n\n确认写入并热加载？`,
    );
    if (!ok) return;
  }

  for (const id of ids) {
    const preview = previewReinfer(id);
    if (preview) writeReinfer(id, preview.updated);
    await publishManagedProvider(pi, ctx.modelRegistry, id);
  }

  const nextSide = loadSidecar();
  nextSide.contextCatalogVersion = CONTEXT_CATALOG_VERSION;
  nextSide.contextCatalogAppliedAt = new Date().toISOString();
  saveSidecar(nextSide);

  ctx.ui.notify(
    `已应用 ${getCatalogLabel()}，变更 ${totalChanged} 处`,
    "info",
  );
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

/**
 * Show thinking levels for current (or selected) model and set one via pi.setThinkingLevel.
 */
async function actionThinking(ctx: Ctx, pi: ExtensionAPI): Promise<void> {
  const current = ctx.model;
  let providerId = current?.provider;
  let modelId = current?.id;

  const source = await selectScrollable(ctx, "查看/设置思考强度", [
    current
      ? `当前模型  ${providerId}/${modelId}`
      : "当前模型  （无）",
    "从 managed provider 选择…",
  ]);
  if (!source) return;

  if (source.startsWith("从 managed")) {
    const pid = await selectManaged(ctx, "选择 provider");
    if (!pid) return;
    const models = loadModels().providers?.[pid]?.models ?? [];
    if (!models.length) {
      ctx.ui.notify("该 provider 无模型", "info");
      return;
    }
    const mid = await selectScrollable(
      ctx,
      "选择模型",
      models.map((m) => m.id),
    );
    if (!mid) return;
    providerId = pid;
    modelId = mid;
    // switch session model first so setThinkingLevel applies to active model
    await publishManagedProvider(pi, ctx.modelRegistry, pid);
    const sw = await switchModel({
      providerId: pid,
      modelId: mid,
      setAsDefault: false,
      pi: { setModel: (m) => pi.setModel(m as never) },
      modelRegistry: {
        refresh: () => ctx.modelRegistry.refresh(),
        find: (p, id) => ctx.modelRegistry.find(p, id),
      },
      setDefault: () => {},
    });
    if (!sw.ok) {
      ctx.ui.notify(sw.message, "error");
      return;
    }
  } else if (!current) {
    ctx.ui.notify("当前无模型，请先 switch 或选择 managed 模型", "error");
    return;
  }

  const live = ctx.modelRegistry.find(providerId!, modelId!);
  const stored = loadModels().providers?.[providerId!]?.models?.find(
    (m) => m.id === modelId,
  );
  // Prefer live registry, then stored config, then official heuristics (so max etc. stay correct)
  const inferred = inferReasoningProfile(modelId!);
  const profile = {
    reasoning:
      (live as { reasoning?: boolean } | undefined)?.reasoning ??
      stored?.reasoning ??
      inferred.reasoning,
    thinkingLevelMap:
      (live as { thinkingLevelMap?: ModelEntry["thinkingLevelMap"] } | undefined)
        ?.thinkingLevelMap ??
      stored?.thinkingLevelMap ??
      inferred.thinkingLevelMap,
    note: inferred.note,
  };

  // If stored map is stale (e.g. missing max for kimi-k3), prefer inferred official map
  const inferredLevels = listSupportedThinkingLevels(inferred);
  const storedLevels = listSupportedThinkingLevels(profile);
  const useProfile =
    inferred.reasoning &&
    inferredLevels.includes("max" as ThinkingLevel) &&
    !storedLevels.includes("max" as ThinkingLevel)
      ? inferred
      : profile;

  const levels = listSupportedThinkingLevels(useProfile);
  const currentLevel =
    typeof pi.getThinkingLevel === "function"
      ? pi.getThinkingLevel()
      : ctx.thinkingLevel;

  const summary = formatThinkingSummary({
    modelId: modelId!,
    ...useProfile,
    current: String(currentLevel ?? ""),
  });

  if (!useProfile.reasoning) {
    ctx.ui.notify(
      `${summary}\n（可 /providers sync-catalog 刷新能力表）`,
      "warning",
    );
    return;
  }

  const labels = levels.map((l) =>
    l === currentLevel ? `${l}  ← 当前` : l,
  );
  const choice = await selectScrollable(
    ctx,
    `思考强度 · ${providerId}/${modelId}\n${summary}`,
    labels,
  );
  if (!choice) return;
  const level = choice.replace(/\s*←.*$/, "").trim() as ThinkingLevel;
  try {
    pi.setThinkingLevel(level);
    ctx.ui.notify(`思考强度 → ${level}（${providerId}/${modelId}）`, "info");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.ui.notify(`设置失败: ${msg}`, "error");
  }
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
        "sync-catalog",
        "apply-context", // alias
        "thinking",
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
            const side = loadSidecar();
            const cat =
              side.contextCatalogVersion === CONTEXT_CATALOG_VERSION
                ? `sync-catalog  同步最新能力表（已是 v${CONTEXT_CATALOG_VERSION}）`
                : `sync-catalog  同步最新能力表（可更新 → v${CONTEXT_CATALOG_VERSION}）`;
            const action = await selectScrollable(ctx, "/providers", [
              "list",
              "add",
              "edit",
              "delete-models",
              "delete",
              "refresh",
              cat,
              "thinking  查看/设置思考强度",
              "switch",
              "test",
            ]);
            if (!action) return;
            const route =
              action.startsWith("sync-catalog") || action.startsWith("apply-context")
                ? "sync-catalog"
                : action.startsWith("thinking")
                  ? "thinking"
                  : action;
            return handlerRoute(route, ctx, pi);
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
    case "sync-catalog":
    case "apply-context": // backward-compatible alias
      return actionApplyLatestContextCatalog(ctx, pi);
    case "thinking":
      return actionThinking(ctx, pi);
    case "switch":
      return actionSwitch(ctx, pi);
    case "test":
      return actionTest(ctx);
    default:
      ctx.ui.notify(`未知子命令: ${sub}`, "error");
  }
}
