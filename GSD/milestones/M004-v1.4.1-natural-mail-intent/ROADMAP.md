# M004 Roadmap: v1.4.1 Natural Mail Intent

**Last Updated**: 2026-03-30
**Status**: Release Ready

## Milestone Goal

在 `M003` 已经具备 `/mail`、`/mailhtml`、`/mailfile` 的基础上，增加一个风险可控的自然语言纯文本邮件入口，让用户可以直接通过聊天文本发出简单邮件。

## Why This Milestone Exists

`M003` 已经把 SMTP 通道打通，但当前邮件体验仍然完全依赖显式命令。与已有的自然语言文件发送相比，邮件入口仍显得偏“机械”：

1. 发一封简单文本邮件仍要记住 `/mail <to> | <subject> | <body>`
2. 已有 `mail.defaultTo`，但在交互层没有真正发挥作用
3. 当前下一步比多 Agent 或更大平台化能力更明确、更低风险

## Definition Of Done

### Truths
- bridge 可以识别明确的自然语言纯文本发邮件请求
- 缺失字段时 bridge 会追问，而不是误发
- `mail.defaultTo` 可以在自然语言路径下生效
- README、help text 和 GSD 已同步到当前能力

### Non-Goals
- 自然语言 HTML 邮件
- 自然语言附件邮件
- provider / 账号体系扩展

## Slice Dependency Order

`S01 -> S02 -> S03`

## Slices

| Slice | Title | Goal | Depends On | Status |
|-------|-------|------|------------|--------|
| S01 | Natural Text Mail Intent | 识别并解析自然语言纯文本邮件请求 | - | Implemented |
| S02 | Bridge UX & Docs Sync | 将解析结果接入 bridge 并同步文档 | S01 | Implemented |
| S03 | Real Inbox UAT & Release Gate | 做真实收件箱验证并决定是否发布 `v1.4.1` | S02 | Implemented |

### S01 - Natural Text Mail Intent

**Result (2026-03-30)**
- 已新增 `src/mail/natural-intent.ts`
- 已支持显式收件人和 `mail.defaultTo` fallback
- 已对缺失收件人/主题/正文返回 clarify，而不是盲发

### S02 - Bridge UX & Docs Sync

**Result (2026-03-30)**
- 已在 `src/bridge/core.ts` 中接入自然语言邮件分支
- 已更新 help text、`README.md`、`README_CN.md`
- 已补 `bridge/core` 与 parser tests

### S03 - Real Inbox UAT & Release Gate

**Result (2026-03-30)**
- 已在真实微信会话中验证显式收件人自然语言邮件
- 已在真实微信会话中验证 `mail.defaultTo` fallback
- 已在真实微信会话中验证缺失正文时的 clarify
- 已确认当前继续维持“HTML/附件走显式命令”的边界

## Exit Criteria

- `S01` ~ `S03` 全部完成
- `npm run build` / `npm run lint` / `npm test -- --runInBand --ci` 通过
- 自然语言邮件路径完成真实 inbox UAT
