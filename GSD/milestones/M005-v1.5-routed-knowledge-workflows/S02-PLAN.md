# M005 S02 Plan: PRISM Memory Core

## Goal

为 `M005` 建立第一版 `PRISM Memory Core`，把当前上下文从“简单 summary”升级为：

- `quick / standard / deep` 三档装载
- `hot / warm / cold` 三层内容
- 基于现有 `ContextState` 的 memory bundle

## Must-haves

- memory contract 落地
- profile selector 落地
- `PRISMMemoryCore` 落地
- bridge `/context` 与 agent 执行路径接入 memory bundle
- 保持现有 agent / mail / media / routing 主路径不回归

## Files

- `src/memory/contract.ts`
- `src/memory/core.ts`
- `src/memory/index.ts`
- `src/memory/core.test.ts`
- `src/bridge/core.ts`
- `src/bridge/core.test.ts`

## Result

- [x] 已新增 `MemoryLoadProfile`、`MemoryEntry`、`MemoryBundle`
- [x] 已新增 `selectMemoryLoadProfile()`
- [x] 已新增 `PRISMMemoryCore`
- [x] `/context` 已输出 `standard` 档 PRISM memory
- [x] CLI agent 执行已改为注入 `PRISM Memory (...)`
