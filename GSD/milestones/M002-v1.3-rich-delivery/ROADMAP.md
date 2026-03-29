# M002 Roadmap: v1.3 Rich Delivery

**Last Updated**: 2026-03-28
**Status**: Release Ready

## Milestone Goal

打通“电脑本地文件/图片 -> bridge -> 微信 ClawBot -> 手机微信”的下发链路，优先解决你现在实际使用中最痛的能力缺口。

## Why This Milestone Exists

用户当前的两个真实痛点里，优先级最高的是：

1. 无法把电脑上的文件通过 ClawBot 发到手机微信端
2. 无法通过邮件发送信息或附件

当前仓库对第 1 点完全没有实现链路：
- `MessageItemType` 虽然预留了 `IMAGE` / `FILE`
- `ILinkClient.parseMessage()` 只解析 `TEXT`
- `ILinkClient.send()` 只发送 `TEXT`
- 没有附件 staging、上传、引用、重试、失败恢复

因此 M002 先聚焦微信侧文件/图片下发。邮件通道单独放到下一个 milestone，避免一个里程碑同时碰两条外部通道。

## Definition Of Done

### Truths
- bridge 可以从本地路径读取图片或文件并发给手机微信端
- 用户能在微信中收到明确的成功/失败反馈
- 附件发送过程有大小、类型、路径和错误处理约束
- README、GSD 和 UAT 都覆盖新的文件下发能力

### Artifacts
- media contract 与 attachment metadata
- 本地附件 staging / 上传 / outbound sender
- bridge 命令面或任务面中的发送入口
- 针对失败、超限和不存在文件的测试

### Key Links
- `local path -> attachment staging -> ilink outbound item_list`
- `bridge command/task -> media sender -> user feedback`
- `rich delivery docs -> UAT -> release checklist`

## Non-Goals

- 不在 M002 中实现邮件发送
- 不在 M002 中实现多账户
- 不在 M002 中实现富文本渲染平台化
- 不在 M002 中实现复杂媒体识别或 OCR

## Slice Dependency Order

`S01 -> S02 -> S03 -> S04 -> S05`

## Slices

| Slice | Title | Goal | Depends On | Risk | Status |
|-------|-------|------|------------|------|--------|
| S01 | Capability Probe & Media Contract | 确认 iLink rich item 能力边界并定义内部附件契约 | - | High | Implemented |
| S02 | Attachment Staging Pipeline | 建立本地附件校验、staging 和 metadata 管线 | S01 | Medium | Implemented |
| S03 | WeChat Outbound File/Image Delivery | 打通图片/文件到微信端的实际发送链路 | S02 | High | Implemented |
| S04 | UX, Safety & Failure Recovery | 补齐命令面、错误提示、尺寸限制和恢复策略 | S03 | Medium | Implemented |
| S05 | Docs, UAT & Release Gate | 文档、UAT、发布口径收口 | S04 | Medium | Implemented |

### S01 - Capability Probe & Media Contract

**Goal**: 把“iLink 到底支持什么 rich item”与“bridge 内部如何表示附件”先定清楚。

**Must-haves**
- Truths:
  - 已确认当前代码只支持文本 item
  - 已定义内部 attachment metadata 结构
  - 已定义图片与普通文件的统一发送入口
- Artifacts:
  - `RESEARCH.md`
  - media contract types
  - S01 UAT / probe script 方案
- Key links:
  - `iLink item_list capability -> internal attachment model`

**Result (2026-03-27)**
- 已确认当前实现只支持文本 item
- 已定义 `MediaAttachmentDraft`、`MediaSendIntent`、`MediaLifecycleStatus`
- 已补 contract 单元测试
- 外部权威 payload 文档仍未确认，作为 S03 输入约束保留

### S02 - Attachment Staging Pipeline

**Goal**: 先解决本地文件读取、校验、mime/type 判定、大小限制和 staging。

**Must-haves**
- Truths:
  - 不存在的路径会被清晰拒绝
  - 超限大小会被清晰拒绝
  - 附件 metadata 可持久化和复用
- Artifacts:
  - attachment staging service
  - type / size validators
  - staging tests
- Key links:
  - `local filesystem -> staged attachment -> outbound sender`

**Result (2026-03-27)**
- 已新增 `attachmentsDir`
- 已实现本地文件存在性/普通文件/大小限制校验
- 已实现 mime 推断与 SHA-256 staging copy
- 已补 staging 单元测试

### S03 - WeChat Outbound File/Image Delivery

**Goal**: 真正把附件发到微信端。

**Must-haves**
- Truths:
  - 图片和普通文件都能走 outbound path
  - rich item 发送失败会回退为明确错误反馈
  - bridge 能把附件发送结果写入会话历史
- Artifacts:
  - outbound media sender
  - `ILinkClient` rich message extension
  - bridge 接线
- Key links:
  - `attachment metadata -> ilink sendmessage -> user feedback`

**Result (2026-03-27)**
- 已通过本机 `openclaw-weixin` 插件源码确认官方 rich media 链路
- 已在 `ILinkClient` 中移植 `getuploadurl + CDN AES upload + sendmessage item_list`
- 已新增 `/sendfile <path>` 作为首个 bridge 入口
- 已通过协议层、bridge 入口和全量自动化验证

### S04 - UX, Safety & Failure Recovery

**Goal**: 把这条链路做成可用而不是“勉强能跑”。

**Must-haves**
- Truths:
  - 用户可以明确指定要发送哪个本地文件
  - 失败信息能区分“路径错误 / 类型不支持 / 超限 / API 错误”
  - 不允许随意发送危险路径或过大文件
- Artifacts:
  - 命令面或明确触发入口
  - 安全限制
  - failure-path tests
- Key links:
  - `user request -> path validation -> outbound media sender`

**Result (2026-03-28)**
- 已新增 `/sendimage <path>`，补齐显式图片发送入口
- 已支持带引号命令参数，允许带空格路径
- 已将本地媒体发送改为结构化结果，区分 staging / upload / send 失败
- 已加入默认大小限制与敏感路径保护
- 已允许 `/sendfile` 将图片按普通附件发送，避免命令歧义
- 已通过 `build/lint/test` 自动化验证

### S05 - Docs, UAT & Release Gate

**Goal**: 把 rich delivery 的实现、手工验证和发布条件收口。

**Must-haves**
- Truths:
  - README 与真实能力一致
  - UAT 明确覆盖图片、普通文件、失败路径
  - release checklist 包含真实设备验证项
- Artifacts:
  - README / README_CN 更新
  - UAT 文档
  - release checklist
- Key links:
  - `implementation -> docs -> device UAT`

**Result (2026-03-28)**
- 已将 `package.json`、startup banner 和 channel version 统一到 `v1.3.0`
- 已同步 `README.md` / `README_CN.md` 到 rich delivery 当前命令面与限制
- 已新增 `S05-PLAN.md`、`S05-UAT.md` 与 `RELEASE-CHECKLIST.md`
- 已完成真实设备 UAT，图片/文件 happy path 与 failure path 均已验证
- 当前里程碑已达到发布就绪状态，可进入 `M003`

## Exit Criteria

- 5 个 slices 全部完成并通过各自验证门
- 用户可以把电脑上的图片/文件稳定发到手机微信端
- 可以进入 M003 Mail Channel
