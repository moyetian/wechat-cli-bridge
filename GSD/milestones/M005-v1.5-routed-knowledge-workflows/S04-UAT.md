# M005 S04 UAT

## Automated Checks

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `npm test -- --runInBand --ci src/research/proposal-adapter.test.ts src/bridge/core.test.ts src/context/manager.test.ts`

## Expected Behaviors

- [x] `给我一个关于小模型路由效率的研究计划` → 进入 `research proposal lane`
- [x] proposal lane 会创建 `research_brief` / `research_proposal` / `research_novelty_check` / `research_budget_estimate` / `research_task`
- [x] proposal lane prompt 会明确禁止直接启动真实实验
- [x] 常规 CLI / media / mail / writing lane 主路径仍不回归

## Metrics

- **Current Test Count**: `147`
