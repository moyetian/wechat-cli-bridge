# S02 Plan: SMTP Text/HTML Delivery

**Milestone**: M003
**Depends On**: S01
**Status**: Implemented

## Slice Goal

打通最小 SMTP 发信能力，先覆盖纯文本与 HTML 正文。

## Must-Haves

### Truths
- SMTP sender 可以发送纯文本邮件
- SMTP sender 可以发送 HTML 邮件
- 配置错误会返回清晰错误信息

### Artifacts
- `src/mail/smtp-sender.ts`
- sender tests
- mail config runtime wiring

### Key Links
- `mail config -> smtp sender -> mail delivery result`

## Result

- 已安装 `nodemailer`
- 已新增 `SMTPMailSender`
- 已支持 text/html 发信
- 已补 sender 单元测试
