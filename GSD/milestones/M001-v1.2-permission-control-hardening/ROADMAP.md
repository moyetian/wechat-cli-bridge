# M001 Roadmap: v1.2 Permission-Control Hardening

**Last Updated**: 2026-03-27
**Status**: In Progress

## Milestone Goal

把项目从“可用的微信桥接器”升级为“权限模式真实生效、可测试、可发布”的微信桥接器。

## Why This Milestone Exists

当前代码已经具备：
- 稳定的 iLink 长轮询和消息分片
- CLI/HTTP agent 适配层
- GSD 风格 session/context 管理

但当前代码仍缺失：
- 真正生效的 permission protocol
- 可移植的测试底座
- 文档、状态、实现的一致性

## Definition Of Done

### Truths
- 用户切换 `interactive/acceptEdits/auto/plan` 后，bridge 行为真实不同
- `plan` 模式不会启动 CLI 子进程
- 待审批请求可以被批准、拒绝、超时，并影响真实执行结果
- 在受限环境和 CI 环境下，测试不会因 home 目录写入副作用而失败
- README、GSD 根文档、里程碑文档对当前版本状态描述一致

### Artifacts
- 路径服务与显式初始化机制
- 权限模式契约与审批状态持久化
- bridge 层审批状态机
- 按 mode 组装参数的 agent 执行器
- CI workflow、UAT 文档、release checklist

### Key Links
- `BridgeConfig.permission.mode -> SessionContext.permissionMode -> Bridge.handleTask`
- `Permission request state -> WeChat command reply -> task execution gate`
- `Path service -> logger/storage bootstrap -> tests and CI`
- `Milestone docs -> root GSD docs -> README`

## Non-Goals

- 不做富媒体消息
- 不做多账户支持
- 不做多 Agent 编排
- 不做 Web 管理界面
- 不承诺原生拦截每一个 CLI 内部工具调用

## Slice Dependency Order

`S01 -> S02 -> S03 -> S04 -> S05`

## Slices

| Slice | Title | Goal | Depends On | Risk | Status |
|-------|-------|------|------------|------|--------|
| S01 | Runtime Base & Testability | 修复运行时副作用与测试底座 | - | Medium | Implemented |
| S02 | Permission Contract | 定义统一权限语义和命令面 | S01 | Medium | Implemented |
| S03 | Approval State Machine | 落地审批请求/响应/超时流程 | S02 | High | Implemented |
| S04 | Agent Enforcement | 让 permission mode 真实影响执行 | S03 | High | Implemented |
| S05 | Release Gate | 收口文档、CI、UAT、发布 | S04 | Medium | Implemented |

### S01 - Runtime Base & Testability

**Goal**: 清除导入副作用，建立可移植测试基座。

**Must-haves**
- Truths:
  - 导入模块不会自动创建 `~/.wechat-cli-bridge`
  - 测试可显式指定临时 bridge home
- Artifacts:
  - 路径服务模块
  - 重构后的 `logger/storage`
  - 测试基座修复
- Key links:
  - `path service -> storage/logger -> index/setup/tests`

**Verification Gate**
- `npm run build`
- `npm run lint`
- `npm test`

**Result (2026-03-27)**
- 已新增路径服务并统一 `index/setup/daemon` 路径约定
- 已移除 `logger/storage` 模块导入副作用
- 自动化验证通过：`build/lint/test`
- 手工 UAT 仍待在真实 ClawBot 环境完成

### S02 - Permission Contract

**Goal**: 在类型、命令、session、config 之间建立单一权限语义。

**Must-haves**
- Truths:
  - config 默认值、session 默认值、运行态默认值一致
  - 用户可查看和管理待审批状态
- Artifacts:
  - 扩展后的 types
  - 更新后的 command parser
  - context/session schema 迁移
- Key links:
  - `config -> context manager -> command handler`

**Verification Gate**
- 权限命令解析测试
- session 读写测试
- 默认值一致性测试

**Result (2026-03-27)**
- 已新增 permission contract 模块
- 已将审批请求写入 session state 并支持 round-trip
- 已补齐 `/pending`、`/approve`、`/deny`
- 已修复 session defaults 覆盖持久化值的问题
- 自动化验证通过：`build/lint/test`

### S03 - Approval State Machine

**Goal**: 让 bridge 具备真实的审批流程，而不是只发提示文本。

**Must-haves**
- Truths:
  - 批准才执行
  - 拒绝或超时不执行
  - 重启后仍可恢复待审批状态
- Artifacts:
  - 待审批记录结构
  - approval service
  - bridge 执行门控逻辑
- Key links:
  - `ILinkClient.requestPermission -> session state -> handleMessage`

**Verification Gate**
- approve/deny/timeout 测试
- pending state 恢复测试
- 同用户互斥测试

**Result (2026-03-27)**
- 已新增 bridge 级 task policy
- 已实现待执行任务持久化与过期同步
- 已实现审批通过后的任务恢复执行
- 已支持快捷回复 `y/yes/n/no`
- 自动化验证通过：`build/lint/test`

### S04 - Agent Enforcement

**Goal**: 将 permission mode 真正下沉到 agent 参数构造和执行策略。

**Must-haves**
- Truths:
  - `auto` 才启用危险 bypass
  - `plan` 不启动子进程
  - `interactive` 和 `acceptEdits` 行为不同
- Artifacts:
  - 参数构造器
  - 任务分类器
  - adapter 测试
- Key links:
  - `permission mode -> classifier -> adapter args -> execute`

**Verification Gate**
- mode-to-args 测试
- `plan` no-spawn 测试
- Windows/Unix 参数构造测试

**Result (2026-03-27)**
- 已新增 CLI permission profiles
- 已将默认 agent 改为 mode-to-args 结构
- 已在 CLIAdapter 中接入动态参数构造与 bridge-approved 自动升级
- 已补 adapter 与 bridge 边界测试
- 自动化验证通过：`build/lint/test`

### S05 - Release Gate

**Goal**: 让 milestone 具备发布和交接条件。

**Must-haves**
- Truths:
  - 根文档与 README 口径一致
  - CI 真实覆盖 build/lint/test
  - milestone 有可执行 UAT
- Artifacts:
  - GitHub Actions workflow
  - 更新后的 README/README_CN/GSD
  - UAT 和 release checklist
- Key links:
  - `package.json scripts -> CI -> docs`

**Verification Gate**
- GitHub Actions 全绿
- 本地 UAT 通过
- release checklist 完成

**Result (2026-03-27)**
- 已更新 CI workflow 并完成本地 YAML 解析验证
- 已同步 README / README_CN / 版本号 / banner
- 已创建 release checklist
- 自动化验证通过：`build/lint/test`

## Exit Criteria

- 5 个 slices 均完成并通过各自验证门
- 不存在“文档宣称已完成、代码仍未接线”的明显漂移
- 可以进入下一里程碑 `v1.3 Rich Media`
