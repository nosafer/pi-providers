# pi-providers

pi coding agent（`@earendil-works/pi-coding-agent`）交互式模型 / 中转管理 extension。  
统一入口 **`/providers`**，避免手写 `models.json`。

当前版本：**0.1.0** · 上下文 catalog：**v2**

## 功能

- 添加 / 编辑 / 删除自建或第三方中转（OpenAI Completions / Anthropic Messages）
- 自动发现 `/v1/models`，多选保留模型
- 密钥写入 `~/.pi/agent/auth.json`，或 `$ENV` 引用
- 热加载：写配置后当前会话可用，无需重启（`/reload` 后加载新插件代码）
- 切换模型：仅本次 / 设为默认
- **按模型推断 contextWindow**（API 字段 + 官方启发式表）
- **`apply-context`**：一键把已配置模型同步到最新上下文表
- **`delete-models`**：删除单个模型，使其不再出现在 `/model`
- 可滚动选择列表（长模型列表光标跟随视口）

## 安装

```bash
cd Projects/pi-providers/code
npm install
ln -sfn "$(pwd)" ~/.pi/agent/extensions/pi-providers
# 重启 pi 或 /reload
```

开发临时加载：

```bash
pi -e ./index.ts
```

## 命令

| 命令 | 说明 |
|------|------|
| `/providers` | 主菜单 |
| `/providers list` | 列出 managed provider |
| `/providers add` | 添加中转 |
| `/providers edit` | 编辑（url / api / key / context / 删模型 / 刷新 / 重算 context） |
| `/providers delete-models` | 删除部分模型（`/model` 中消失） |
| `/providers delete` | 删除整个 provider |
| `/providers refresh` | 刷新远端模型列表 |
| `/providers apply-context` | **应用最新上下文表**（含思考能力启发式；插件更新后点这个） |
| `/providers thinking` | **查看/设置当前模型思考强度**（按模型显示可用级别） |
| `/providers switch` | 切换当前 / 默认模型 |
| `/providers test` | 连通测试 |

### 思考强度

pi 级别：`off` / `minimal` / `low` / `medium` / `high` / `xhigh` / `max`。  
是否可用取决于模型的 `reasoning` + `thinkingLevelMap`（添加/`apply-context` 时按名称推断）。

```text
/providers thinking          # 看当前模型支持哪些级别并切换
pi --thinking high           # 启动时
pi --model mkopen/gpt-5.5:high
```

配置文件：

| 文件 | 内容 |
|------|------|
| `~/.pi/agent/models.json` | provider + models |
| `~/.pi/agent/auth.json` | API key |
| `~/.pi/agent/settings.json` | 默认模型（switch 设为默认时） |
| `~/.pi/agent/pi-providers.json` | managed 列表、selectedModelIds、catalog 版本 |

原生 `/model`、`--provider`/`--model` 仍可用。

## 上下文表（catalog v2）

优先级：接口字段 → 名称启发式 → 128k。

| 示例 | context |
|------|---------|
| gpt-5.6-* | 1.05M |
| gpt-5.x | 1M |
| grok-4.5 | **500k**（xAI 官方） |
| grok-4.3 / 4.20 | 1M |
| glm-5.2 | 1M |
| glm-5.1 / glm-5 | 200k |
| gemini-3* | 1M |

插件更新启发式后：`/providers apply-context`。

## 开发

```bash
npm test
npm run typecheck
```

## 项目记忆

CodeWork 记忆层：`Projects/pi-providers/`（`PROJECT_*`、`docs/superpowers/`）。
