# M005 S05 Plan: Sandboxed Research Execution

## Goal

按“混合方案”落地第一版 research executor 骨架：

- `remote_http` backend
- `local_gpu` backend
- 批准后的 `research_run_request` 会真正提交到 executor
- run manifest / runtime config / request / response / queue ticket 等 artifacts 落盘

## Must-haves

- executor contract 与 config normalization
- `remote_http / local_gpu` 双 backend skeleton
- 批准后的 research run submission
- local queue ticket 落盘
- integration-missing / failed / submitted 三类状态区分
- 保持 proposal lane、writing lane、CLI、mail、media 主路径不回归

## Files

- `src/research/executor.ts`
- `src/research/executor.test.ts`
- `src/research/index.ts`
- `src/types/index.ts`
- `src/index.ts`
- `src/setup.ts`
- `src/bridge/core.ts`
- `src/bridge/core.test.ts`

## Result

- [x] 已新增 `ResearchExecutor`
- [x] 已支持 `remote_http / local_gpu` 双 backend
- [x] 已支持 runtime config normalization
- [x] 已支持批准后 research run submission
- [x] `local_gpu` backend 已落盘 queue ticket
- [x] `remote_http` backend 已支持 HTTP POST skeleton
