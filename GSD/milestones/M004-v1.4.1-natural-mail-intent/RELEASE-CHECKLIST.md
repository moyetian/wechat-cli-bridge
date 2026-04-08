# M004 Release Checklist

**Milestone**: M004
**Version Target**: v1.4.1
**Status**: Release Ready

## Code Gate

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] 自然语言纯文本邮件已接入 bridge

## Docs Gate

- [x] `README.md` 已补自然语言邮件示例
- [x] `README_CN.md` 已补自然语言邮件示例
- [x] `GSD/STATE.md` / `ROADMAP.md` / `HISTORY.md` 已同步

## UAT Gate

- [x] 在真实微信会话验证自然语言纯文本邮件
- [x] 在真实收件箱验证 `mail.defaultTo` fallback

## Open Items

- [x] 当前继续维持“HTML/附件邮件走显式命令”的边界
