# Roadmap: WeChat CLI Bridge

## v1.0 - MVP (Complete)

**Goal**: 核心功能可用

- [x] iLink API 连接
- [x] CLI Agent 执行
- [x] 基础命令系统
- [x] 二维码登录
- [x] Windows 兼容

## v1.1 - Stability (Complete)

**Goal**: 提升稳定性和用户体验

- [x] 完善错误处理和重连机制 → 指数退避 1s→60s
- [x] 添加心跳检测 → 30s 心跳，`isHealthy()` + `getStats()`
- [x] 实现消息重试 → 已在 v1.0 实现
- [x] 完善日志系统 → Winston 多级别日志
- [x] 添加健康检查命令 → `getStats()` API

**新增 (2026-03-25)**:
- [x] ESLint 代码质量检查
- [x] Jest 单元测试框架 (33 tests)
- [x] 命令注入防护
- [x] 任务超时进程清理 (SIGTERM + SIGKILL)

## v1.2 - Permission Control Hardening (Implemented As M001)

**Goal**: 把权限模式从“文案配置”升级为“真实执行协议”，并补齐可测试、可发布的工程底座

**Milestone Directory**: `GSD/milestones/M001-v1.2-permission-control-hardening/`

### Slices

| Slice | Goal | Depends On | Status |
|-------|------|------------|--------|
| S01 | Runtime Base & Testability | - | Implemented |
| S02 | Permission Contract | S01 | Implemented |
| S03 | Approval State Machine | S02 | Implemented |
| S04 | Agent Enforcement | S03 | Implemented |
| S05 | Release Gate | S04 | Implemented |

### Slice Intent

#### S01 - Runtime Base & Testability
- [x] 抽出路径解析与 bridge home 目录管理
- [x] 移除 `logger/storage` 导入副作用
- [x] 修复 Jest/CI 环境可移植性

#### S02 - Permission Contract
- [x] 统一 config/session/runtime 的 permission 默认值
- [x] 扩展权限命令面：`/permission`、`/approve`、`/deny`、`/pending`
- [x] 定义 permission action 分类和审批记录结构

#### S03 - Approval State Machine
- [x] 实现权限请求/响应/超时流程
- [x] 落地待审批状态持久化
- [x] 将审批结果写入 HISTORY/STATE

#### S04 - Agent Enforcement
- [x] 按 permission mode 构造 CLI 参数
- [x] 实现 `plan` 模式不启动 CLI 进程
- [x] 建立 bridge 层任务分类器

#### S05 - Release Gate
- [x] 同步 README、README_CN、GSD 根文档
- [x] 加入 GitHub Actions
- [x] 编写 milestone UAT 与 release checklist

## Current Milestone - M003 / v1.4 Mail Channel (Release Ready)

**Goal**: 增加独立于微信的邮件发送能力，先打通 SMTP 纯文本/HTML/附件发送

**Milestone Directory**: `GSD/milestones/M003-v1.4-mail-channel/`

### Planned Slices

| Slice | Goal | Depends On | Status |
|-------|------|------------|--------|
| S01 | Mail Contract & Provider Decision | - | Implemented |
| S02 | SMTP Text/HTML Delivery | S01 | Implemented |
| S03 | Attachment Delivery | S02 | Implemented |
| S04 | WeChat Command UX | S03 | Implemented |
| S05 | UAT & Release Gate | S04 | Implemented |

## M002 / v1.3 Rich Delivery (Release Ready)

**Goal**: 打通“电脑文件/图片 -> 微信 ClawBot -> 手机微信”的下发链路，并给后续邮件通道留出统一的附件抽象

**Milestone Directory**: `GSD/milestones/M002-v1.3-rich-delivery/`

### Planned Slices

| Slice | Goal | Depends On | Status |
|-------|------|------------|--------|
| S01 | Capability Probe & Media Contract | - | Implemented |
| S02 | Attachment Staging Pipeline | S01 | Implemented |
| S03 | WeChat Outbound File/Image Delivery | S02 | Implemented |
| S04 | UX, Safety & Failure Recovery | S03 | Implemented |
| S05 | Docs, UAT & Release Gate | S04 | Implemented |

## v1.2 - Permission Control (Scope Captured By M001)

**Goal**: 实现权限管控

- [ ] 实现权限请求/响应流程
- [ ] 支持工具级别权限控制
- [ ] 添加权限白名单
- [ ] 敏感操作二次确认

## v1.3 - Rich Delivery (Release Ready)

**Goal**: 打通“电脑本地文件/图片 -> 微信 ClawBot -> 手机微信”的下发链路

- [x] media contract 与本地 staging pipeline
- [x] `getuploadurl + CDN upload + sendmessage item_list`
- [x] `/sendfile` 与 `/sendimage`
- [x] 默认大小、类型和敏感路径限制
- [x] 真实设备 UAT 与 release hold 解除

## v1.4 - Mail Channel (Release Ready)

**Goal**: 增加独立于微信的邮件发送能力

- [x] Mail contract 与 SMTP config contract
- [x] SMTP 配置与发送器
- [x] 纯文本 / HTML 邮件正文
- [x] 本地文件附件
- [x] 微信命令面 `/mail` / `/mailhtml` / `/mailfile`
- [x] README / README_CN / template config 已同步到当前能力
- [x] 真实邮箱 UAT 与 release hold 解除

## v1.5 - Multi-Agent (Planned)

**Goal**: 多 Agent 协作

- [ ] Agent 链式调用
- [ ] 任务分发和聚合
- [ ] Agent 状态同步
- [ ] 结果缓存

## v2.0 - Platform (Future)

**Goal**: 平台化

- [ ] 多用户支持
- [ ] Web 管理界面
- [ ] 插件系统
- [ ] API 开放

---

**Last Updated**: 2026-03-29
