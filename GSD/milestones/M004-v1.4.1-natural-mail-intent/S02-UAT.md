# M004 S02 UAT

## Automated Checks

- [x] `npm test -- --runInBand --ci src/mail/natural-intent.test.ts src/bridge/core.test.ts src/commands/handler.test.ts`
- [x] `npm run build`
- [x] `npm run lint`

## Expected Behaviors

- [x] 自然语言邮件请求命中时不会启动 agent
- [x] 会调用现有 mail sender 发出纯文本邮件草稿
- [x] 帮助文本与 README 能看到自然语言邮件示例
