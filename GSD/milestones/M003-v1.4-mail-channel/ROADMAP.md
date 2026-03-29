# M003 Roadmap: v1.4 Mail Channel

**Last Updated**: 2026-03-29
**Status**: Release Ready

## Milestone Goal

增加独立于微信的邮件发送能力，先打通“bridge -> SMTP -> 收件箱”的最小可用链路，并复用现有附件 staging 能力发送本地文件附件。

## Why This Milestone Exists

在 `M002` 完成后，当前最明显的能力缺口已经从“微信文件下发”转移到“邮件发送”：

1. 还不能把任务结果通过邮件发给指定邮箱
2. 还不能把本地文件作为邮件附件发出去
3. 当前仓库没有 SMTP provider、邮件配置契约或命令入口

邮件能力和微信 rich delivery 不同，新的风险集中在：
- provider 选择
- 凭据配置
- 发件人与默认收件人策略
- HTML / 纯文本 / 附件的组合方式

因此 `M003` 需要单独作为一个 milestone 来做。

## Definition Of Done

### Truths
- bridge 可以通过 SMTP 发送纯文本邮件
- bridge 可以通过 SMTP 发送 HTML 邮件
- bridge 可以把本地文件作为邮件附件发送
- README、GSD、UAT 和 release checklist 都覆盖邮件发送能力

### Artifacts
- mail contract 与 SMTP config contract
- SMTP sender
- 微信命令面或自然语言入口
- 针对失败路径和附件路径的测试

### Key Links
- `mail config -> SMTP sender -> inbox delivery`
- `local attachment -> staging -> mail attachment -> inbox delivery`
- `wechat request -> bridge mail action -> user feedback`

## Non-Goals

- 不在 `M003` 中实现 IMAP 收信
- 不在 `M003` 中实现 OAuth provider 集成
- 不在 `M003` 中实现复杂模板系统
- 不在 `M003` 中实现邮件线程同步回微信

## Slice Dependency Order

`S01 -> S02 -> S03 -> S04 -> S05`

## Slices

| Slice | Title | Goal | Depends On | Risk | Status |
|-------|-------|------|------------|------|--------|
| S01 | Mail Contract & Provider Decision | 定义邮件契约、配置契约和 provider 边界 | - | Medium | Implemented |
| S02 | SMTP Text/HTML Delivery | 打通 SMTP 纯文本/HTML 发送 | S01 | High | Implemented |
| S03 | Attachment Delivery | 复用本地附件 staging，支持邮件附件 | S02 | High | Implemented |
| S04 | WeChat Command UX | 补齐微信端命令面和自然语言入口 | S03 | Medium | Implemented |
| S05 | UAT & Release Gate | 文档、UAT、发布口径收口 | S04 | Medium | Implemented |

### S01 - Mail Contract & Provider Decision

**Goal**: 先确定邮件发送的内部数据模型和 SMTP 配置契约，避免后续 sender 实现返工。

**Must-haves**
- Truths:
  - 已确定 `v1.4` 首版 provider 为 `SMTP`
  - 已定义邮件地址、收件人、正文和附件的内部契约
  - 已定义 SMTP config normalization 与 readiness 判定
- Artifacts:
  - `src/mail/contract.ts`
  - `src/mail/config.ts`
  - mail contract tests
- Key links:
  - `config.json mail section -> normalized mail config -> future sender`

**Result (2026-03-28)**
- 已新增邮件地址、收件人、消息草稿与附件契约
- 已新增 SMTP config normalization 与 summary/readiness helper
- 已补 contract/config 单元测试

### S02 - SMTP Text/HTML Delivery

**Goal**: 打通最小 SMTP 发信能力，先覆盖纯文本和 HTML 正文。

**Must-haves**
- Truths:
  - SMTP 可在无附件场景稳定发送
  - 纯文本与 HTML 都能给出清晰结果反馈
  - 邮件配置错误会返回明确错误信息
- Artifacts:
  - SMTP sender
  - text/html tests
  - config validation wiring
- Key links:
  - `mail config -> smtp sender -> mail delivery result`

**Result (2026-03-29)**
- 已安装 `nodemailer`
- 已新增 `SMTPMailSender`
- 已支持 text/html 发信
- 已补 sender 单元测试

### S03 - Attachment Delivery

**Goal**: 把现有本地附件 staging 能力复用到邮件附件发送。

**Must-haves**
- Truths:
  - 本地文件可作为邮件附件发送
  - 附件大小和类型边界清晰
  - 当前微信媒体 staging 能力可在邮件通道复用
- Artifacts:
  - mail attachment sender
  - attachment tests
- Key links:
  - `stageLocalMedia -> mail attachment -> smtp sender`

**Result (2026-03-29)**
- 已在邮件发送路径中复用 `stageLocalMedia`
- 已支持附件大小限制
- 已完成附件主路径测试

### S04 - WeChat Command UX

**Goal**: 在微信侧提供清晰的邮件命令面或自然语言入口。

**Must-haves**
- Truths:
  - 用户可以明确指定收件人、主题、正文和附件
  - 错误提示能区分配置错误、地址错误、SMTP 错误
  - 不会误把普通聊天文本当成发邮件指令
- Artifacts:
  - command UX
  - bridge integration
  - flow tests
- Key links:
  - `wechat request -> bridge mail intent -> smtp sender`

**Result (2026-03-29)**
- 已新增 `/mail`、`/mailhtml`、`/mailfile`
- 已补收件人校验与错误提示
- 已在真实微信会话中完成 text/html/file 手工验证

### S05 - UAT & Release Gate

**Goal**: 把邮件能力的实现、手工验证和发布条件收口。

**Must-haves**
- Truths:
  - README / README_CN 与邮件能力一致
  - UAT 覆盖 text/html/attachment/错误路径
  - release checklist 明确 SMTP 凭据与真实收件箱验证
- Artifacts:
  - docs
  - UAT
  - release checklist
- Key links:
  - `implementation -> docs -> inbox UAT -> release checklist`

**Result (2026-03-29)**
- 已补 `S05-PLAN.md`、`S05-UAT.md` 与 `RELEASE-CHECKLIST.md`
- 已同步 `README.md`、`README_CN.md` 与 `templates/config.example.json`
- 已通过真实 SMTP 收件箱 UAT
- 已将版本口径提升到 `v1.4.0`

## Exit Criteria

- 5 个 slices 全部完成并通过各自验证门
- bridge 可以稳定发送纯文本、HTML 和附件邮件
- 可以进入后续 `M004` 或发布 `v1.4.0`
