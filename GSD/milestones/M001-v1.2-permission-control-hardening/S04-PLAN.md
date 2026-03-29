# S04 Plan: Agent Enforcement

**Milestone**: M001
**Depends On**: S03
**Status**: Implemented

## Slice Goal

让 permission mode 不只影响 bridge 是否审批，还真实影响各 CLI 的启动参数和执行策略。

## Must-Haves

### Truths
- 默认 agent 不再静态写死危险 bypass 参数
- `interactive / acceptEdits / auto` 在 CLI 启动参数上存在真实差异
- 已批准任务恢复执行时，不会再被 CLI 二次交互卡住
- 参数构造策略可被纯函数测试和 adapter 测试覆盖

### Artifacts
- `src/agents/cli-permissions.ts`
- 重构后的 `src/agents/cli-adapter.ts`
- 更新后的默认 agent config
- profile / adapter / bridge 三层测试

### Key Links
- `permission mode -> cli profile -> adapter args -> spawn`
- `bridge approval -> bridgeApproved -> effective CLI mode`

## Implementation Tasks

### T01 - Introduce CLI Permission Profiles
- 定义 invocation mode、prompt args、permission args
- 为默认 agent 建立 mode-to-args 映射

### T02 - Refactor CLIAdapter
- 由静态 `args` 改为通过 profile 动态构造
- 清理历史危险参数，避免重复注入
- 支持 bridge-approved 自动升级为 auto execution

### T03 - Validate Spawn Arguments
- 新增纯函数测试验证 mode-to-args
- 新增 adapter 测试验证实际 spawn 参数

### T04 - Verify Bridge Boundary Semantics
- 验证待审批后 mode 变化不会破坏已批准任务恢复
- 确保 `plan` 只阻止新任务，不会误伤已经批准的任务

## Result

- 默认 agent 已采用 permission profile
- adapter 已按 mode 生成实际 CLI 参数
- 已批准任务恢复执行不会再卡在 CLI 交互确认
- 自动化验证通过：`build/lint/test`

## Out Of Scope

- README/README_CN 同步
- GitHub Actions
- 微信文件发送、邮件发送能力

## Exit Criteria

- S04 must-haves 全部为真
- M001 剩余工作只剩 release gate 与能力缺口评估
