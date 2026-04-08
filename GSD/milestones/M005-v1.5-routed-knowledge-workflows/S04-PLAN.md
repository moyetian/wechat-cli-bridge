# M005 S04 Plan: Research Proposal Lane

## Goal

把 `research_idea / research_plan` 从“只识别 route”推进到真正的 `research proposal lane`：

- research workflow job
- proposal / novelty / budget artifact model
- proposal lane prompt builder
- bridge 到 proposal agent 的执行接线

## Must-haves

- `research` 模块落地
- proposal artifacts 落盘
- proposal lane 不启动真实实验
- proposal lane prompt 明确包含预算 / 风险 / 下一步审批点
- 保持现有 routing / memory / writing / CLI / mail / media 路径不回归

## Files

- `src/research/contract.ts`
- `src/research/proposal-adapter.ts`
- `src/research/index.ts`
- `src/research/proposal-adapter.test.ts`
- `src/bridge/core.ts`
- `src/bridge/core.test.ts`

## Result

- [x] `research proposal lane` adapter 已新增
- [x] proposal / novelty / budget artifacts 已落盘
- [x] 已支持在 proposal lane 选择可用 agent
- [x] prompt 已明确禁止直接启动真实实验
- [x] `research_idea / research_plan` 已接入 bridge 执行链
