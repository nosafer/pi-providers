# Changelog

## Unreleased

- **热加载不再丢 `compat`**：`registerProvider` 改走 `buildManagedProviderRegistration()`，把 provider/model 级 `compat` 摊到每个模型上（扩展层模型会整表替换 `models.json`，否则 Pi 会发 `role=developer`）
- 新增 `src/compat.ts`：sharellm 主机自动推断 `supportsDeveloperRole: false`；合并顺序为「推断 → 已有配置 → 显式覆盖」
- `/providers` 编辑 provider 不再冲掉已有 `compat`，sharellm 漏写也会自动补
- `/providers` 写模型时按 pi-ai 官方 catalog 同步 `input`（有图才带 `image`，DeepSeek 等纯文本不带）
- `sync-catalog` 一并同步 `input`；catalog 版本升到 v6
- 热加载 / 切模型 / 删除不再 `await refresh()`：避免启动时全 provider 探活卡在空输入框；`registerProvider` / `unregisterProvider` 已同步更新目录

## 0.1.0 — 2026-08-01

### Features

- `/providers` 全流程：list / add / edit / delete / delete-models / refresh / switch / test / thinking / **sync-catalog**
- store：`models.json` + `auth.json` + sidecar `pi-providers.json`
- 模型发现、多选、连通测试、热加载 `registerProvider` + `setModel`
- 可滚动 `SelectList`（长列表视口跟随光标）
- **能力元数据以 pi-ai 官方 catalog 为主**（`src/generated/pi-ai-catalog.json`，约 1000+ 模型）
  - 字段：`contextWindow` / `reasoning` / `thinkingLevelMap`
  - 再生：`npm run regen-catalog`（`src/regen-catalog.ts`，与 `/providers sync-catalog` 自动再生同一实现）
- `/providers sync-catalog` 一键同步能力表（旧名 `apply-context` 兼容）
- `/providers thinking` 按模型列出官方思考档位并 `setThinkingLevel`
- context 优先级：网关 API 字段 → pi-ai catalog → 启发式 → 128k

### Official examples (from pi-ai)

- kimi-k3: ~1M · low/high/**max**
- grok-4.5: 500k · low/medium/high
- gpt-5.5: 272k default · low…xhigh
- claude-opus-4-7: 1M · … + xhigh/max
- gemini-3 pro: ~1M · low/high；flash 常开思考
- glm-5.2 / deepseek-v4: high/max class maps

### Tests

- 42 unit tests（store / discover / refresh / multi-select / context / reasoning / catalog-lookup）
