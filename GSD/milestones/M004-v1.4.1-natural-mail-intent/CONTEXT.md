# M004 Context

## Current Reality

1. `M003` 已完成 SMTP text / html / attachment 三条命令路径。
2. `src/bridge/core.ts` 已有自然语言直达动作模式，但只覆盖本地媒体发送。
3. 现有邮件能力已经具备 `mail.defaultTo`，但命令路径必须显式写收件人，默认收件人没有真正发挥价值。
4. 当前代码和运行时版本口径已经是 `1.4.1`。

## Constraints

- 必须避免把普通“开发邮件功能”的任务误判成“立即发邮件”
- 不应破坏 `/mail`、`/mailhtml`、`/mailfile` 现有命令面
- SMTP 凭据仍只允许保存在本地配置

## Useful Links

- `src/bridge/core.ts`
- `src/mail/contract.ts`
- `src/mail/config.ts`
- `src/commands/handler.ts`
