# M005 S02 UAT

## Automated Checks

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `npm test -- --runInBand --ci src/memory/core.test.ts src/bridge/core.test.ts`

## Expected Behaviors

- [x] `research_run_request` 默认会选到 `deep` profile
- [x] `article_create` 默认会选到 `standard` profile
- [x] `quick` 档不会强行装入 `cold` 内容
- [x] `deep` 档会装入 `cold archive`
- [x] agent 执行收到的 `context` 已变为 `PRISM Memory (...)` 格式

## Metrics

- **Current Test Count**: `141`
