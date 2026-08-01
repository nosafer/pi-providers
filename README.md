# pi-providers

pi coding agent 交互式模型 / 中转管理 extension。统一入口 `/providers`。

## 开发

```bash
cd Projects/pi-providers/code
npm install
npm test
npm run typecheck

# 临时加载
pi -e ./src/index.ts
```

## 安装（全局）

```bash
ln -sfn "$(pwd)" ~/.pi/agent/extensions/pi-providers
# 重启 pi 或 /reload 后使用 /providers
```

## 命令

- `/providers` — 主菜单
- `/providers add|edit|delete|refresh|switch|test|list`
