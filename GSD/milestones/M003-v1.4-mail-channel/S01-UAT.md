# S01 UAT: Mail Contract & Provider Decision

**Status**: Automated Contract Gate Passed

## Checklist

- [x] 确定首版 provider 为 `SMTP`
- [x] 确定邮件地址、收件人、正文和附件的数据结构
- [x] 确定 SMTP config normalization 与 readiness helper
- [x] 保留 `mail_attachment` 与现有 media layer 的连接点

## Automated Evidence

- [x] `npm run build`
- [x] `npx jest src/mail/contract.test.ts src/mail/config.test.ts --runInBand --ci`

## Pass Criteria

- 后续 SMTP sender 实现不会因为 contract/config 漂移而返工
- 邮件通道的 provider 边界已经清晰
