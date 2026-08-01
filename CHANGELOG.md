# Changelog

## 0.1.0 — 2026-08-01

### Features

- `/providers` 全流程：list / add / edit / delete / delete-models / refresh / switch / test
- store：`models.json` + `auth.json` + sidecar `pi-providers.json`
- 模型发现、多选、连通测试
- 热加载 `registerProvider` + 会话 `setModel`
- 可滚动 `SelectList`（长列表视口跟随光标）
- 按模型 context 推断（API + 官方启发式 catalog v2）
- `/providers apply-context` 一键应用最新上下文表
- contextWindow 预设与统一覆盖（可选）

### Fixes / UX

- 去掉多余显示名步骤（仅 provider id）
- 添加后可选立即切换模型
- grok-4.5 按 xAI 官方 500k；glm-5.1 按智谱 200k

### Tests

- 26 unit tests（store / discover / refresh / multi-select / context-infer）
