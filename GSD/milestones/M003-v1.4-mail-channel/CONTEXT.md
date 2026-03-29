# M003 Context: v1.4 Mail Channel

**Last Updated**: 2026-03-28

## Mission

在微信通道已经可用之后，补齐“通过邮件发送结果和附件”这条独立通道。

## Current Repo Truths

1. 当前仓库没有 SMTP provider，也没有任何邮件发送实现。
2. `src/media/contract.ts` 已预留 `mail_attachment` intent。
3. `src/media/staging.ts` 已具备本地文件校验、大小限制和 staging copy，可作为邮件附件输入层复用。
4. 当前 bridge 命令面只有微信消息发送入口，没有邮件入口。
5. 当前配置体系没有 mail section，也没有凭据管理契约。

## Planning Decision

`M003` 首版只做 `SMTP` 发信，不做 IMAP 收信，不做 OAuth。

原因：
- SMTP 是邮件发送的最小可移植底座
- IMAP / OAuth 会显著扩大 provider 差异和配置复杂度
- 当前用户需求明确集中在“把信息或附件发出去”

## Open Unknowns

1. 是否引入第三方 SMTP 依赖，还是先用最小自实现 sender。
2. 首版微信命令面应以显式命令为主，还是兼容自然语言入口。
3. 默认附件大小限制是否沿用微信附件限制，还是单独定义邮件附件限制。

## Validation Strategy

### Automated
- mail contract tests
- SMTP config normalization tests
- sender tests
- bridge mail-flow tests

### Manual
- 发送一封纯文本邮件
- 发送一封 HTML 邮件
- 发送一个本地附件
- 验证错误配置
- 验证错误收件人

## Deferred Work

- IMAP 收信
- OAuth / provider-specific login
- 模板系统
- 将收件箱回复同步回微信
