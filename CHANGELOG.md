# Changelog

## 0.1.0 — 2026-08-01

### Features

- `/providers` 全流程：list / add / edit / delete / delete-models / refresh / switch / test / thinking
- store：`models.json` + `auth.json` + sidecar `pi-providers.json`
- 模型发现、多选、连通测试
- 热加载 `registerProvider` + 会话 `setModel`
- 可滚动 `SelectList`（长列表视口跟随光标）
- 按模型 context + 思考强度推断（官方/pi-ai catalog **v4**）
- `/providers sync-catalog` 一键同步能力表（旧名 `apply-context` 兼容）
- `/providers thinking` 按模型列出可用思考强度并设置
- contextWindow 预设与统一覆盖（可选）

### Official thinking maps (examples)

- kimi-k3: low/high/**max**
- grok-4.5: low/medium/high
- gpt-5.5 / 5.6, claude opus 4.7+, gemini-3 pro/flash, glm-5.2, deepseek-v4

### Fixes / UX

- 去掉多余显示名步骤（仅 provider id）
- 添加后可选立即切换模型
- grok-4.5 context 500k（xAI）；glm-5.1 200k（智谱）

### Tests

- 33+ unit tests
