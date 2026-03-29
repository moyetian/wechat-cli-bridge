# S02 UAT: SMTP Text/HTML Delivery

**Status**: Passed

## Automated Evidence

- [x] `npm run build`
- [x] `npx jest src/mail/contract.test.ts src/mail/config.test.ts src/mail/smtp-sender.test.ts --runInBand --ci`

## Manual Checklist

- [x] 使用真实 SMTP 凭据发送一封纯文本邮件
- [x] 使用真实 SMTP 凭据发送一封 HTML 邮件
- [x] 确认收件箱能正常收到
