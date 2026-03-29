# Project: WeChat CLI Bridge

> 让微信控制 CLI Agent 干活

## Vision

构建一个桥接工具，让用户可以通过微信 ClawBot 控制 CLI Agent（如 iFlow、Claude Code、Codex、Gemini）执行编程任务。

## Tech Stack

- **Runtime**: Node.js 18+ / TypeScript
- **API**: WeChat iLink Bot API (`https://ilinkai.weixin.qq.com`)
- **CLI Agents**: iFlow CLI, Claude Code, Codex, Gemini CLI

## Architecture

```
微信 ClawBot
    │
    ▼
iLink API (HTTP 长轮询)
    │
    ▼
Bridge Core (~200行胶水层)
    │
    ├── Context Manager (GSD 风格)
    │
    └── Agent Adapters
            │
            ├── CLIAdapter (iFlow, Claude, Codex, Gemini)
            └── HTTPAdapter (OpenClaw)
```

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| 使用 TypeScript | 类型安全，更好的 IDE 支持 | 2026-03-23 |
| iLink API 独立于 OpenClaw | 不依赖特定框架，更灵活 | 2026-03-23 |
| GSD 风格上下文管理 | 解决 context rot 问题 | 2026-03-23 |
| Windows shell: true 执行 | npm 全局命令需要 shell 查找 | 2026-03-23 |

## Files

```
wechat-cli-bridge/
├── src/
│   ├── index.ts           # 入口
│   ├── setup.ts           # 二维码登录
│   ├── bridge/
│   │   ├── core.ts        # 核心胶水层
│   │   └── ilink-client.ts # iLink API
│   ├── agents/
│   │   ├── base.ts        # Agent 基类
│   │   ├── cli-adapter.ts # CLI 执行
│   │   └── http-adapter.ts
│   ├── context/
│   │   └── manager.ts     # 上下文管理
│   └── commands/
│       └── handler.ts     # 命令处理
└── dist/                  # 编译输出
```

## Status

**Current Phase**: MVP 完成，核心功能可用

**Last Updated**: 2026-03-23
