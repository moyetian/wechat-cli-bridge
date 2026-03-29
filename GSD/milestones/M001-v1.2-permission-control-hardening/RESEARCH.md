# M001 Research Notes

**Date**: 2026-03-27

## Source Audit Summary

### Bridge Execution
- `src/bridge/core.ts`
- 结论：
  - `/permission` 只更新 `context.permissionMode`
  - `handleTask()` 不检查 permission mode，直接执行 `agent.execute()`

### Permission Surface
- `src/types/index.ts`
- `src/bridge/ilink-client.ts`
- 结论：
  - 类型层已有 `needsPermission` / `permissionRequest`
  - 传输层已有 `requestPermission()`
  - 缺的是 bridge 级状态机和持久化

### Agent Defaults
- `src/agents/index.ts`
- `src/agents/cli-adapter.ts`
- 结论：
  - iFlow/Gemini 默认 `-y`
  - Claude/Codex 默认危险 bypass
  - 当前实现天然绕过了未来权限模式

### Session And Defaults
- `src/context/manager.ts`
- `src/index.ts`
- 结论：
  - config 默认 permission = `auto`
  - 新 session 默认 permission = `interactive`
  - 旧 session fallback 逻辑存在错误写法

### Runtime Side Effects
- `src/utils/logger.ts`
- `src/utils/storage.ts`
- 结论：
  - 导入即创建目录
  - 破坏测试隔离
  - 在 sandbox/CI 中会放大为稳定性问题

## Evidence From Local Verification

### Passed
- `npm run build`

### Failed
- `npx jest src/commands/handler.test.ts src/utils/storage.test.ts --runInBand --ci`

### Failure Pattern
- `ENOENT: no such file or directory, mkdir '/home/moyetian/.wechat-cli-bridge'`

## Planning Implications

1. S01 不能省略，也不能并到 S04 之后做。
2. 权限实现必须走 bridge-level gate，而不是先寄希望于 CLI 自带审批协议。
3. 文档收口必须作为显式 slice，而不是附带工作。

## Recommended Execution Style

- 每个 slice 完成后立即修正文档和状态
- 不在一个 slice 里同时改路径底座和权限状态机
- 对 Windows 行为单独保留测试和验证步骤
