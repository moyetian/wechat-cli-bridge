# M005 S06 UAT

## Automated Checks

- [x] `npm test -- --runInBand --ci src/agents/cli-adapter.test.ts src/agents/cli-permissions.test.ts`
- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `npm test -- --runInBand --ci src/governance/engine.test.ts src/research/executor.test.ts src/commands/handler.test.ts src/bridge/core.test.ts`
- [x] `npm run research:mock-worker -- --once --queue-dir ... --status-dir ...`
- [x] `npm run uat:m005-local`
- [x] `npm run uat:m005-bridge`
- [x] `npm run uat:m005-doctor`
- [x] `npm run uat:m005-remote-probe -- --endpoint http://119.91.50.158:8081 --timeout-ms 4000`
- [x] `npm run uat:m005-remote-probe -- --endpoint http://119.91.50.158/research-executor --timeout-ms 4000`
- [x] `npm test -- --runInBand --ci src/research/remote-http-server.test.ts src/research/executor.test.ts`
- [x] `npm test -- --runInBand --ci src/uat/m005-remote-probe.test.ts`
- [x] 2026-04-08 真实公网 `submit -> poll -> completed`（经 `http://119.91.50.158/research-executor`）

## Expected Behaviors

- [x] research workflow 会落盘 governance report / release gate artifacts
- [x] `research_run_request` 会记录 `computePool / runId`
- [x] `/status` 会刷新 queued/running research run 的状态
- [x] `/recover [jobId]` 会对 failed research run 执行 requeue / resubmit
- [x] 显式要求联网的 research run 在 `allowNetwork=false` 时会被治理门阻断
- [x] writing lane 会保留 release gate，而不是默认自动发布
- [x] mock worker 会消费 queue ticket 并写回 `statusDir`
- [x] queue -> worker -> poll `completed` 的本地 smoke UAT 已通过
- [x] writing mock mode 会直接生成 `outline.md` / `draft.md`
- [x] one-command runner 会联跑 article + research mock UAT 并输出报告
- [x] bridge harness 会联跑 article + research + approve + status，并输出 transcript
- [x] doctor 会输出真实环境缺口与 next actions
- [x] `codex` 在非 git working directory 下会自动补 `--skip-git-repo-check`
- [x] `codex` 会获得 workflow artifact 目录写权限
- [x] 真实微信 article lane 已完成一轮 `outline.md` / `draft.md` 落盘 UAT
- [x] 真实微信 `research request -> /approve -> /status` 已完成一轮 `completed` UAT
- [x] 真实微信 `research request(模拟失败) -> /approve -> /status -> /recover [jobId] -> /status` 已完成一轮 recovery UAT

## Manual Gap

- [x] 当前机器已接入真实 WeWrite skill
- [x] 当前仓库最小 `remote_http` executor 服务已部署到腾讯云 Ubuntu 22.04 + Docker
- [ ] 当前尚未接入真实 local GPU worker 写回 `statusDir`
- [x] 2026-04-08 已通过 nginx `/research-executor/` 路径公开 remote executor，并返回 `200`
- [x] 2026-04-08 本机 bridge 配置已切到 `http://119.91.50.158/research-executor`
- [ ] 公网裸露 `http://119.91.50.158:8081` 仍不是推荐入口；当前生产形态改为 nginx reverse proxy，而不是直曝 8081

## Metrics

- **Current Test Count**: `188`
