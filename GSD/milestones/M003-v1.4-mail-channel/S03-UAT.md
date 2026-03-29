# S03 UAT: Attachment Delivery

**Status**: Passed

## Automated Evidence

- [x] `npm run build`
- [x] `npx jest src/bridge/core.test.ts src/mail/smtp-sender.test.ts --runInBand --ci`

## Manual Checklist

- [x] 使用真实 SMTP 凭据发送本地附件
- [x] 确认收件箱附件可下载
- [x] 验证附件大小超限报错
