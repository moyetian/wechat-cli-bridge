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

- [x] 错误处理和重连机制
- [x] 心跳检测与健康状态
- [x] Jest / ESLint / CI 基线
- [x] 命令注入防护与超时清理

## v1.2 - Permission Control Hardening (Implemented As M001)

**Goal**: 把权限模式从“文案配置”升级为“真实执行协议”

**Milestone Directory**: `GSD/milestones/M001-v1.2-permission-control-hardening/`

| Slice | Goal | Status |
|-------|------|--------|
| S01 | Runtime Base & Testability | Implemented |
| S02 | Permission Contract | Implemented |
| S03 | Approval State Machine | Implemented |
| S04 | Agent Enforcement | Implemented |
| S05 | Release Gate | Implemented |

## Current Milestone - M005 / v1.5 Routed Knowledge Workflows (Release Ready)

**Goal**: 把当前微信桥升级为一个可路由、可记忆、可审批、可治理的知识工作控制平面，统一承载文章生产、研究立项和研究执行 workflow

**Milestone Directory**: `GSD/milestones/M005-v1.5-routed-knowledge-workflows/`

### Planned Slices

| Slice | Goal | Depends On | Status |
|-------|------|------------|--------|
| S01 | Semantic Gateway & Job Model | - | Implemented |
| S02 | PRISM Memory Core | S01 | Implemented |
| S03 | Writing Lane / WeWrite Integration | S02 | Implemented |
| S04 | Research Proposal Lane | S02 | Implemented |
| S05 | Sandboxed Research Execution | S04 | Implemented |
| S06 | Governance, Compute & Release Gate | S05 | Implemented |

### Slice Intent

#### S01 - Semantic Gateway & Job Model
- [x] 微信入口 route / lane / gate / workflow job 契约
- [x] 启发式 routing gateway
- [x] `research_run_request` 审批入口
- [x] workflow job 状态持久化

#### S02 - PRISM Memory Core
- [x] `PRISMMemoryCore`
- [x] `quick / standard / deep` 渐进装载
- [x] hot / warm / cold context 边界

#### S03 - Writing Lane / WeWrite Integration
- [x] 微信到文章生产的首条 lane
- [x] 文章 artifact 模型
- [x] 缺失 WeWrite 时的明确提示与 graceful fallback

#### S04 - Research Proposal Lane
- [x] 研究立项
- [x] novelty / feasibility / budget 粗检
- [x] proposal lane prompt 与 artifacts

#### S05 - Sandboxed Research Execution
- [x] `ResearchExecutor` skeleton
- [x] `remote_http / local_gpu` submission backends
- [x] run manifest / runtime config / queue ticket artifacts

#### S06 - Governance, Compute & Release Gate
- [x] governance report / release gate artifacts
- [x] `wechat_realtime / writing_batch / research_sandbox` compute pool
- [x] `research_run_request` 预算 / 运行时 / 安全门评估
- [x] `/status` research run 状态刷新
- [x] `/recover [jobId]` 失败 run 恢复入口
- [x] local / remote executor 状态轮询 contract
- [x] `local_gpu` mock worker，本地可跑 queue -> status -> recover UAT
- [x] `WeWrite` mock mode，本地可跑 brief -> outline -> draft UAT
- [x] `npm run uat:m005-local` 一键本地 UAT runner
- [x] `npm run uat:m005-bridge` bridge 等价本地 UAT harness
- [x] `npm run uat:m005-doctor` 真实环境 readiness / gap report
- [x] `codex` 在非 git 工作目录下会自动补 `--skip-git-repo-check`
- [x] `codex` 会获得 writing / research workflow artifact 目录写权限
- [x] 真实微信 article lane 已通过 `codex` + WeWrite prompt 收口后的实机 UAT

## M004 / v1.4.1 Natural Mail Intent (Release Ready)

**Goal**: 在现有 SMTP 邮件通道上增加自然语言纯文本邮件入口，并保持现有命令面可用

**Milestone Directory**: `GSD/milestones/M004-v1.4.1-natural-mail-intent/`

### Planned Slices

| Slice | Goal | Depends On | Status |
|-------|------|------------|--------|
| S01 | Natural Text Mail Intent | - | Implemented |
| S02 | Bridge UX & Docs Sync | S01 | Implemented |
| S03 | Real Inbox UAT & Release Gate | S02 | Implemented |

### Slice Intent

#### S01 - Natural Text Mail Intent
- [x] 识别明确的自然语言发邮件请求
- [x] 抽取收件人、主题、正文
- [x] 支持 `mail.defaultTo` fallback
- [x] 对缺失字段进行追问

#### S02 - Bridge UX & Docs Sync
- [x] 在 bridge 中短路自然语言邮件请求，不启动 agent
- [x] 更新 help text / README / README_CN
- [x] 回写根级 GSD 与 milestone 文档

#### S03 - Real Inbox UAT & Release Gate
- [x] 在真实微信会话中验证自然语言纯文本邮件
- [x] 在真实收件箱中验证 `mail.defaultTo` fallback
- [x] 将 `M004` 标记为 `v1.4.1` release ready

## M003 / v1.4 Mail Channel (Release Ready)

**Goal**: 增加独立于微信的邮件发送能力

**Milestone Directory**: `GSD/milestones/M003-v1.4-mail-channel/`

| Slice | Goal | Status |
|-------|------|--------|
| S01 | Mail Contract & Provider Decision | Implemented |
| S02 | SMTP Text/HTML Delivery | Implemented |
| S03 | Attachment Delivery | Implemented |
| S04 | WeChat Command UX | Implemented |
| S05 | UAT & Release Gate | Implemented |

## M002 / v1.3 Rich Delivery (Release Ready)

**Goal**: 打通本地文件/图片到微信会话的下发链路

**Milestone Directory**: `GSD/milestones/M002-v1.3-rich-delivery/`

| Slice | Goal | Status |
|-------|------|--------|
| S01 | Capability Probe & Media Contract | Implemented |
| S02 | Attachment Staging Pipeline | Implemented |
| S03 | WeChat Outbound File/Image Delivery | Implemented |
| S04 | UX, Safety & Failure Recovery | Implemented |
| S05 | Docs, UAT & Release Gate | Implemented |

## v1.5 - Routed Knowledge Workflows (Scope Captured By M005)

**Goal**: 用微信作为控制平面，统一文章、CLI 和研究工作流

- [x] 微信语义路由与 gate
- [x] PRISM 风格记忆与上下文分层
- [x] `writing lane`
- [x] `research lane`
- [x] 队列 / 审批 / 成本 / sandbox 统一治理

## v2.0 - Platform (Future)

**Goal**: 平台化

- [ ] 多用户支持
- [ ] Web 管理界面
- [ ] 插件系统
- [ ] API 开放

---

**Last Updated**: 2026-04-08
