# Project: WeChat CLI Bridge

> 让微信控制 CLI Agent 干活

## Vision

构建一个桥接工具，让用户可以通过微信 ClawBot 控制 CLI Agent（如 iFlow、Claude Code、Codex、Gemini）执行编程任务。

## Planned Evolution

在当前 bridge release ready 的前提下，已经捕获下一阶段候选方向：

- 让微信前门同时控制 `general cli lane`、`writing lane`、`research lane`
- 用 `semantic-router` 做意图门控
- 用 `mem0 + prism-mcp` 做 PRISM 风格上下文与记忆层
- 用 `WeWrite` 承载公众号文章生产
- 用 `AI Scientist-v2` 承载异步研究与论文草稿生成

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
│   ├── governance/        # workflow gate / compute / release policy
│   ├── research/          # proposal / executor / recovery
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

**Current Phase**: 运行时版本口径现已切到 `v1.5.0`；`M005-v1.5-routed-knowledge-workflows` 已完成 `S01` 到 `S06`，并已补齐 mock worker、mock mode、bridge-local UAT harness、doctor、remote endpoint probe 与 nginx-backed public endpoint；真实微信 article lane 与 research lane 均已完成实机 UAT，公网 remote executor 已完成真实 `submit -> poll -> completed` 验证，当前可视为 release ready

**Last Updated**: 2026-04-08
