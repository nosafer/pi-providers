# pi-providers

pi coding agent（`@earendil-works/pi-coding-agent`）交互式模型 / 中转管理 extension。  
统一入口 **`/providers`**，避免手写 `models.json`。

当前版本：**0.1.0** · 能力 catalog：**v5**（pi-ai 官方模型表）  
仓库：https://github.com/nosafer/pi-providers

## 功能

- 添加 / 编辑 / 删除自建或第三方中转（OpenAI Completions / Anthropic Messages）
- 自动发现 `/v1/models`，多选保留模型
- 密钥写入 `~/.pi/agent/auth.json`，或 `$ENV` 引用
- 热加载：写配置后当前会话可用（`/reload` 后加载新插件代码）
- 切换模型：仅本次 / 设为默认
- **上下文 + 思考强度**：优先查 **pi-ai 官方 catalog**（约 1000+ 模型），其次网关字段 / 启发式
- **`sync-catalog`**：一键把已配置模型同步到最新能力表
- **`thinking`**：按当前模型列出官方可用思考档位并设置
- **`delete-models`**：删除单个模型，使其不再出现在 `/model`
- 可滚动选择列表（长列表光标跟随视口）

## 安装

```bash
cd Projects/pi-providers/code
npm install
./scripts/deploy-plugin.sh   # 部署到 ~/.pi/agent/extensions/pi-providers（独立副本）
# 重启 pi 或 /reload
```

插件目录是**独立部署产物**（不含 `.git` / `node_modules` / `tests` / `scripts`），与源码仓库分离。

## 更新

### 改了插件代码

```bash
./scripts/deploy-plugin.sh   # 重新部署到插件目录
# 重启 pi 或 /reload
```

### pi 升级后（模型表更新）

直接在 pi 里运行：

```
/providers sync-catalog
```

插件会自动检测 pi-ai 官方数据是否更新 → 自动重新生成 catalog → 应用到你的模型配置。
不需要重启，不需要手动跑脚本。

> 注意：auto-regen 写入的是**插件目录**的 catalog（独立副本）。若之后要改插件代码并重新部署，部署脚本会自动把更新的 catalog 同步回源码仓库，保持两者一致。

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
| `/providers edit` | 编辑 url / api / key / context / 删模型 / 刷新 |
| `/providers delete-models` | 删除部分模型（`/model` 中消失） |
| `/providers delete` | 删除整个 provider |
| `/providers refresh` | 刷新远端模型列表 |
| `/providers sync-catalog` | **同步最新能力表**（上下文 + 思考；插件更新后点这个） |
| `/providers thinking` | **查看/设置思考强度**（按模型官方档位） |
| `/providers switch` | 切换当前 / 默认模型 |
| `/providers test` | 连通测试 |

> 旧名 `apply-context` 仍可用，等同于 `sync-catalog`。

### 元数据从哪来（对齐官方）

| 优先级 | 来源 |
|--------|------|
| 1 | 中转 `GET /v1/models` 返回的 context 字段（若有） |
| 2 | **pi-ai 内置 catalog**（`src/generated/pi-ai-catalog.json`，自 `@earendil-works/pi-ai` 的 `providers/data/*.json` 生成，与 OpenCode/pi 同源） |
| 3 | 少量名称启发式（仅未知 id） |
| 4 | 默认 context 128k；reasoning=false |

再生 catalog（pi 升级后）：

```bash
npm run regen-catalog   # 读取本机 pi-ai dist/providers/data
npm test
```

然后：`/reload` → `/providers sync-catalog`。

### 思考强度示例（摘自 pi-ai 表）

| 模型 | 上下文 | 可用思考档位（pi） |
|------|--------|-------------------|
| **kimi-k3** | ~1M | low, high, **max** |
| **grok-4.5** | 500k | low, medium, high |
| **gpt-5.5** | 272k（官方默认短窗；可手动/override 到 1.05M） | low…xhigh |
| **gpt-5.6-sol/terra/luna** | 见 catalog | low…**max** |
| **claude-opus-4-7** | 1M | off…high + **xhigh/max** |
| **claude-sonnet-4-5** | 1M（anthropic 表） | off…high |
| **gemini-3.1-pro** | ~1M | **low / high**（LOW/HIGH） |
| **gemini-3.6-flash** | ~1M | 思考常开（无 off） |
| **glm-5.2** | ~1M | high, **max**（及 map 内其它非 null） |
| **deepseek-v4-pro** | 1M | high, **max** |

```text
/providers sync-catalog
/providers thinking
pi --thinking high
pi --model mkopen/kimi-k3:max
```

配置文件：

| 文件 | 内容 |
|------|------|
| `~/.pi/agent/models.json` | provider + models |
| `~/.pi/agent/auth.json` | API key |
| `~/.pi/agent/settings.json` | 默认模型 |
| `~/.pi/agent/pi-providers.json` | managed 列表、catalog 版本 |

原生 `/model`、`--provider`/`--model` 仍可用。

## 开发

```bash
npm test
npm run typecheck
npm run regen-catalog   # 从已安装的 pi-ai 重生成官方表
```

## 项目记忆

CodeWork：`Projects/pi-providers/`（`PROJECT_*`、`docs/superpowers/`）。
