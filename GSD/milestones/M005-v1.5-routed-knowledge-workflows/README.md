# M005: v1.5 Routed Knowledge Workflows

**Status**: Active Milestone, S06 Implemented

## Goal

把当前 `wechat-cli-bridge` 从“微信控制 CLI Agent”扩展为一个更通用的微信知识工作控制平面，支持：

- 通过微信一句话触发公众号文章生产
- 通过微信交互发起、审批、跟踪自动化科学研究
- 用 `PRISM` 风格的上下文/记忆/路由策略控制复杂任务成本

## Why This Milestone Exists

当前仓库已经完成：

- 微信到 CLI 的控制链路
- 文件/图片下发
- SMTP 邮件发送
- 自然语言邮件入口

下一阶段最自然的扩展，不再是单一命令能力，而是把微信前门升级成一个“多工作流控制平面”：

- `WeWrite` 负责公众号文章生产线
- `AI Scientist-v2` 负责研究生产线
- `semantic-router` 负责微信网关门控
- `mem0` + `prism-mcp` 负责长期记忆和渐进式上下文装载

## Non-Goals

- 不在 `M005` 首阶段直接把 `AI Scientist-v2` 暴露成同步聊天式 agent
- 不在 `M005` 首阶段自动对外发布文章或自动提交论文
- 不在 `M005` 首阶段支持无限制的 GPU/高成本任务自动执行

## Current Docs

- `ROADMAP.md`
- `CONTEXT.md`
- `RESEARCH.md`
- `S01-PLAN.md`
- `S01-UAT.md`
- `S02-PLAN.md`
- `S02-UAT.md`
- `S03-PLAN.md`
- `S03-UAT.md`
- `S04-PLAN.md`
- `S04-UAT.md`
- `S05-PLAN.md`
- `S05-UAT.md`
- `S06-PLAN.md`
- `S06-UAT.md`
