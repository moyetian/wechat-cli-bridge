# M005 S03 UAT

## Automated Checks

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `npm test -- --runInBand --ci src/writing/wewrite-adapter.test.ts src/bridge/core.test.ts src/context/manager.test.ts`

## Expected Behaviors

- [x] 本地缺少 WeWrite 时，系统会创建 article workflow job 和 artifacts，并明确提示安装要求
- [x] 检测到本地 WeWrite + 可用 `claude` agent 时，系统会触发 writing lane 执行
- [x] article workflow 会产生 `article_brief` / `wewrite_task` / `article_outline` / `article_draft` artifacts
- [x] 常规 CLI / media / mail 主路径仍不回归

## Manual Gap

- [ ] 当前机器尚未安装真实 WeWrite skill，真实 article lane UAT 待后续环境接入

## Metrics

- **Current Test Count**: `145`
