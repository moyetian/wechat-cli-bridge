# S03 Plan: Approval State Machine

**Milestone**: M001
**Depends On**: S02
**Status**: Implemented

## Slice Goal

把审批流从“命令和数据结构存在”升级为“bridge 执行路径真实经过审批状态机”。

## Must-Haves

### Truths
- 需要审批的任务不会立即执行
- 审批通过后可以恢复执行
- 审批过期后不能再批准
- 同一用户存在待审批任务时，新的任务会被阻塞

### Artifacts
- `src/permissions/policy.ts`
- pending execution 持久化结构
- bridge 审批主路径接线
- bridge 主流程测试

### Key Links
- `policy -> approval request -> pending execution -> bridge resume`
- `session load -> expire overdue approvals -> deny execution`

## Implementation Tasks

### T01 - Introduce Task Policy
- 分类 task 为 `read/edit/execute/network/destructive/other`
- 定义不同 permission mode 下的 bridge 级审批触发规则

### T02 - Persist Pending Executions
- 在 session state 中记录待执行任务
- 将 approval request 与 pending execution 通过 requestId 关联

### T03 - Expire Overdue Requests
- 在加载 session 时处理超时审批
- 同步更新 pending execution 状态

### T04 - Wire Bridge Resume Flow
- 任务进入待审批时不启动 agent
- `/approve` 或快捷 `y/yes` 后恢复执行
- `/deny` 或快捷 `n/no` 后拒绝执行
- 待审批期间阻塞新的任务

### T05 - Verify At Three Levels
- policy 定向测试
- context state machine 定向测试
- bridge 主路径定向测试

## Result

- bridge 审批流已形成真实闭环
- 过期审批会在 session 加载时自动失效
- `plan` 模式已具备基础 no-exec 行为
- 自动化验证通过：`build/lint/test`

## Out Of Scope

- CLI flag 级权限映射
- 不同 CLI 的细粒度 mode 差异
- 富媒体和邮件能力

## Exit Criteria

- S03 must-haves 全部为真
- S04 只需关注 agent 参数和模式细化，不必返工状态机
