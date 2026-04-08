# M005 S06 Plan: Governance, Compute & Release Gate

## Goal

为 `M005` 补上第一版治理层，把 workflow 从“能跑”收口到“可治理、可轮询、可恢复”：

- budget / runtime / safety / release gate
- `wechat_realtime / writing_batch / research_sandbox` compute pool
- research run 状态轮询
- 失败 run 恢复入口

## Must-haves

- 新增 governance engine 与结构化 gate report
- `WorkflowJob` 持久化 `computePool / runId`
- `research executor` 支持状态轮询
- `research executor` 支持恢复失败 run
- `/status` 能刷新 research run 状态
- `/recover [jobId]` 能触发失败 run 的恢复
- README / GSD / help text 与新命令同步

## Files

- `src/governance/engine.ts`
- `src/governance/index.ts`
- `src/governance/engine.test.ts`
- `src/research/executor.ts`
- `src/research/executor.test.ts`
- `src/research/local-gpu-worker.ts`
- `src/research/local-gpu-worker.test.ts`
- `src/bridge/core.ts`
- `src/bridge/core.test.ts`
- `src/context/manager.ts`
- `src/types/index.ts`
- `src/commands/handler.ts`
- `src/commands/handler.test.ts`
- `src/setup.ts`
- `README.md`
- `README_CN.md`

## Result

- [x] 已新增 governance report / release gate artifacts
- [x] 已支持 workflow compute pool 分配
- [x] 已支持 `research_run_request` 预算 / 运行时 / 安全门评估
- [x] 已支持 `pollRunStatus()` 与 `recoverRun()`
- [x] 已支持 `/recover [jobId]`
- [x] 已支持 `/status` 主动刷新 research run 状态
- [x] 已支持本地 `local_gpu` mock worker
