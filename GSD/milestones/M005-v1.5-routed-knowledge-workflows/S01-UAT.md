# M005 S01 UAT

## Automated Checks

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `npm test -- --runInBand --ci src/routing/router-adapter.test.ts src/context/manager.test.ts src/bridge/core.test.ts`

## Expected Behaviors

- [x] `写一篇关于 AI 路由的公众号文章` → 识别为 `article_create workflow`
- [x] `帮我写一篇公众号文章` → 返回 clarify，而不是误触发 workflow
- [x] `开始跑实验，研究小模型路由的上下文效率` → 识别为 `research_run_request` 且进入审批流
- [x] 常规 CLI 任务仍继续走现有 agent 路径
- [x] workflow job 会持久化到 session state

## Metrics

- **Current Test Count**: `137`
