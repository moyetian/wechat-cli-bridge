# M005 S05 UAT

## Automated Checks

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `npm test -- --runInBand --ci src/research/executor.test.ts src/bridge/core.test.ts`

## Expected Behaviors

- [x] `local_gpu` backend 启用时，会将 request 写入 queue ticket
- [x] `remote_http` 未配置 endpoint 时，会返回 integration-missing，而不是伪装提交成功
- [x] `research_run_request` 经审批后会真正提交到 executor
- [x] run manifest / runtime config / executor request artifacts 会落盘

## Manual Gap

- [ ] 当前尚未接入真实 remote executor endpoint
- [ ] 当前尚未接入真实 `AI Scientist-v2` local worker

## Metrics

- **Current Test Count**: `150`
