# Changelog

## Unreleased

- `/providers` 写模型时按 pi-ai 官方 catalog 同步 `input`（有图才带 `image`，DeepSeek 等纯文本不带）
- `sync-catalog` 一并同步 `input`；catalog 版本升到 v6

## 0.1.0 — 2026-08-01

### Features

- `/providers` 全流程：list / add / edit / delete / delete-models / refresh / switch / test / thinking / **sync-catalog**
- store：`models.json` + `auth.json` + sidecar `pi-providers.json`
- 模型发现、多选、连通测试、热加载 `registerProvider` + `setModel`
- 可滚动 `SelectList`（长列表视口跟随光标）
- **能力元数据以 pi-ai 官方 catalog 为主**（`src/generated/pi-ai-catalog.json`，约 1000+ 模型）
  - 字段：`contextWindow` / `reasoning` / `thinkingLevelMap`
  - 再生：`npm run regen-catalog`（`scripts/regen-pi-ai-catalog.py`）
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
