# M004 S03 UAT

## Manual Checks

- [x] 在真实微信会话中发送：`给 296528868@qq.com 发邮件，主题是 M004 REAL UAT 2026-03-30 explicit，内容是 这封邮件来自微信自然语言入口。`
- [x] 用户确认真实收件箱收到显式收件人纯文本邮件
- [x] 在真实微信会话中发送：`发邮件，主题是 M004 REAL UAT 2026-03-30 defaultTo，内容是 这封邮件走 defaultTo。`
- [x] 用户确认默认收件人收到 fallback 邮件

## Failure Checks

- [x] 缺失正文时，bridge 会追问
- [x] `mail.from` 缺失时，bridge 会明确报错

## Observed Notes

- 首轮真实微信 UAT 暴露出 `setup` 会覆盖已有 `mail` 配置的问题，导致 `from` 与 `defaultTo` 丢失。
- 修复 `src/setup.ts` 并恢复本地 UAT 配置后，第二轮真实微信 UAT 通过。
