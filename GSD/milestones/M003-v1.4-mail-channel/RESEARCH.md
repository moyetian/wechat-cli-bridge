# M003 Research Notes

**Date**: 2026-03-28

## Local Code Audit

### Existing Reusable Media Layer
- `src/media/contract.ts`
- `src/media/staging.ts`
- 发现：
  - 已存在 `mail_attachment` send intent
  - 已存在本地文件 staging、mime 推断和大小限制
- 结论：
  - 邮件附件不需要重新发明本地文件准备流程

### Existing Bridge And Config Gap
- `src/bridge/core.ts`
- `src/index.ts`
- `src/setup.ts`
- 发现：
  - 当前没有 mail section config
  - 当前 bridge 没有 mail command 或自然语言入口
  - 当前没有 SMTP sender
- 结论：
  - `M003` 必须先做 contract/config/provider 三层底座

## Provider Decision

首版选 `SMTP`。

原因：
1. 发送链路最短
2. 大多数邮箱服务都能兼容
3. 不要求收信或 provider-specific API

不纳入当前 milestone：
- IMAP
- OAuth
- Gmail / Outlook 专有 SDK

## Planning Implications

1. S01 先定义 contract/config，不急着写 bridge 命令面。
2. S02 才实现 SMTP 正文发送。
3. S03 复用现有附件 staging 来完成邮件附件。
4. S05 的手工验证必须以真实收件箱为准，而不是只看单元测试。
