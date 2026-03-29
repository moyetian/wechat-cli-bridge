# S02 Plan: Permission Contract

**Milestone**: M001
**Depends On**: S01
**Status**: Implemented

## Slice Goal

统一权限模式的单一事实源，补齐命令面和 session 持久化结构，为后续审批状态机和执行门控提供稳定契约。

## Must-Haves

### Truths
- config、session、runtime 对 permission mode 的解析一致
- `ContextManager.load()` 不会再用 defaults 覆盖已保存 session 值
- session state 能持久化审批请求
- `/pending`、`/approve`、`/deny` 命令可用

### Artifacts
- `src/permissions/contract.ts`
- 扩展后的 permission/approval types
- `ContextManager` approval request 持久化与解析逻辑
- 更新后的命令处理和状态展示

### Key Links
- `permission contract -> command handler -> bridge core`
- `permission contract -> context manager -> session.json`

## Implementation Tasks

### T01 - Introduce Permission Contract Module
- 提炼 `DEFAULT_PERMISSION_MODE`
- 提炼 permission mode 描述与校验逻辑
- 提炼 action category / decision 类型

### T02 - Extend Types And Session Schema
- 为 `types/index.ts` 增加 approval request 结构
- 将审批请求纳入 `ContextState`
- 确保序列化和反序列化可正常 round-trip

### T03 - Fix Context Defaults
- 用 config permission 作为 session 缺省值来源
- 修复 load defaults 覆盖持久化 session 的问题

### T04 - Expand Command Surface
- 新增 `/pending`
- 新增 `/approve [requestId]`
- 新增 `/deny [requestId]`
- 更新 `/help` 和 `/status`

### T05 - Add Tests
- `handler.test.ts`
- `context/manager.test.ts`
- round-trip、歧义匹配、默认值一致性验证

## Result

- 权限契约模块已落地
- session state 已支持审批请求持久化
- 命令面已可查看和处理审批请求
- 自动化验证通过：`build/lint/test`

## Out Of Scope

- 自动创建审批请求
- 超时处理
- 任务执行前拦截
- mode 到 CLI 参数的真实映射

## Exit Criteria

- S02 must-haves 全部为真
- S03 可以直接实现审批状态机，不需要再返工契约层
