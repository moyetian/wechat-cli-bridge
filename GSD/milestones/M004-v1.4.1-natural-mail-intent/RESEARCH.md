# M004 Research

## Existing Building Blocks

- `src/mail/contract.ts`
  - 已有收件人、主题、正文契约
- `src/mail/config.ts`
  - 已有 `mail.defaultTo`
- `src/bridge/core.ts`
  - 已有自然语言媒体意图处理路径

## Key Risks

1. **误触发风险**
   - 如果规则太宽，普通编码任务会被误判成发邮件
   - 当前策略：要求明确邮件动作，并出现主题/正文标签

2. **范围膨胀风险**
   - 如果同时把 HTML / 附件都塞进自然语言解析，复杂度会快速失控
   - 当前策略：`M004` 只做纯文本主路径

3. **默认收件人语义**
   - `mail.defaultTo` 应只在用户明确表达“发邮件”时才生效

## Decision

- `M004` 首版只做自然语言纯文本邮件
- HTML 和附件继续保留显式命令入口
