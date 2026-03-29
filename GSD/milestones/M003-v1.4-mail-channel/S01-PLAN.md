# S01 Plan: Mail Contract & Provider Decision

**Milestone**: M003
**Depends On**: none
**Status**: Implemented

## Slice Goal

先把邮件通道的内部契约、SMTP 配置契约和 provider 边界定清楚，为后续 sender 实现建立稳定底座。

## Must-Haves

### Truths
- 已确定首版 provider 为 `SMTP`
- 已定义邮件地址、收件人、正文、附件和草稿状态的内部契约
- 已定义 SMTP 配置 normalization 与 readiness 判定

### Artifacts
- `src/mail/contract.ts`
- `src/mail/config.ts`
- `src/mail/index.ts`
- contract/config tests

### Key Links
- `config.json mail section -> normalized mail config -> future SMTP sender`
- `media mail_attachment intent -> mail attachment contract`

## Implementation Tasks

### T01 - Define Mail Contract
- 邮件地址结构
- 收件人结构
- text/html/multipart 正文格式
- 附件与 `MediaAttachmentDraft` 的关系

### T02 - Define Mail Config Contract
- SMTP host / port / secure / user / pass
- from / replyTo / defaultTo
- attachment size policy

### T03 - Add Validation Helpers
- 地址解析
- recipient list parsing
- config readiness / summary helper

## Result

- 邮件契约和 SMTP 配置契约已落地
- 当前还没有 sender，但后续实现边界已清晰
- 自动化定向验证通过

## Exit Criteria

- S02 可以在不返工 config/contract 的前提下直接实现 SMTP sender
