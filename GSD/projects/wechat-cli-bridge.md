# WeChat CLI Bridge

**Created**: 2026-03-23
**Repository**: https://github.com/moyetian/wechat-cli-bridge
**Status**: M002 Release Ready

## What It Does

让微信控制 CLI Agent 干活。微信发一条"帮我修 auth.py 的 bug"，背后的 iFlow/Claude/Codex 就去读文件、找 bug、改代码、跑测试，然后把结果发回微信。

## Tech Stack

- TypeScript
- Node.js >= 18
- iLink API (微信 ClawBot)
- CLI Agents: iFlow, Claude Code, Codex, Gemini

## Quick Start

```bash
cd C:\Users\admin\Desktop\wechat-cli-bridge
npm install
npm run build
npm run setup  # 扫描二维码登录
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `/help` | 显示帮助 |
| `/status` | 查看状态 |
| `/iflow <task>` | 使用 iFlow 执行 |
| `/claude <task>` | 使用 Claude 执行 |
| `/cd <path>` | 切换目录 |
| `/sendimage <path>` | 发送本地图片 |
| `/sendfile <path>` | 发送本地文件附件 |

## Key Files

```
src/
├── bridge/core.ts        # 核心胶水层
├── bridge/ilink-client.ts # iLink API 客户端
├── agents/cli-adapter.ts  # CLI 执行器
├── context/manager.ts     # 上下文管理
└── commands/handler.ts    # 命令处理
```

## Related Projects

- [wechat-claude-code](https://github.com/Wechat-ggGitHub/wechat-claude-code)
- [GSD](https://github.com/gsd-build/get-shit-done)
- [WeClaw](https://github.com/fastclaw-ai/weclaw)
