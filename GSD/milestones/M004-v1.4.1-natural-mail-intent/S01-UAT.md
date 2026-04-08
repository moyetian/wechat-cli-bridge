# M004 S01 UAT

## Automated Checks

- [x] `npm test -- --runInBand --ci src/mail/natural-intent.test.ts`

## Expected Behaviors

- [x] 明确收件人 + 主题 + 正文时，可解析为自然语言邮件意图
- [x] 已配置 `mail.defaultTo` 时，可在省略收件人的情况下解析
- [x] 缺失正文等必要字段时，会返回 clarify
