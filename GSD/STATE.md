# State: WeChat CLI Bridge

**Last Updated**: 2026-04-08
**Session**: 2026-04-08

## Current Status

**Phase**: M005 Release Ready - Routed Knowledge Workflows
**Status**: 运行时版本口径现已切到 `v1.5.0`。`M003-v1.4-mail-channel` 与 `M004-v1.4.1-natural-mail-intent` 继续保持 release ready；`M005-v1.5-routed-knowledge-workflows` 现也可标记为 release ready。当前已落地 governance report / release gate artifacts、`wechat_realtime / writing_batch / research_sandbox` 三类 compute pool、research executor 状态轮询与失败恢复、`/recover [jobId]`，并新增 `local_gpu` mock worker、`remote_http` 最小 executor 服务 `npm run research:remote-server`、`deploy/remote-executor/` 云端部署产物、`WeWrite` mock mode、`npm run uat:m005-local` 一键本地 UAT runner、`npm run uat:m005-bridge` 的 bridge 等价 UAT harness、`npm run uat:m005-doctor` 环境体检工具，以及 `npm run uat:m005-remote-probe` 远端探针。`setup` 已完成，真实 `WeWrite` 已安装到 `~/.openclaw/skills/wewrite`，bridge 非 mock 模式下已能识别真实 skill；writing lane 现已切到 `codex` fallback，且 `codex exec` 在非 git 工作目录下会自动补 `--skip-git-repo-check`、向 writing / research artifact 目录透传 `--add-dir`，同时 WeWrite prompt 已收紧为最小读取集。真实微信 article lane 已完成一轮实机 UAT，成功生成并落盘 `outline.md` / `draft.md`；真实微信 research request -> `/approve` -> `/status` 与 `/recover [jobId]` 也已完成实机 UAT。2026-04-08 先用 probe 确认公网裸露 `http://119.91.50.158:8081/health` 不稳定，随后改为通过现有 nginx `:80` 新增 `/research-executor/` 反代到 `127.0.0.1:8081`，并将本机 bridge 配置切到 `http://119.91.50.158/research-executor`。新的公网 endpoint 已通过 `health`、受保护 API 路由 probe、`doctor 6 pass / 0 warn / 0 fail`，以及一轮真实 `submit -> poll -> completed`。最新 build、lint 与 full test 已通过，测试总数维持 `188`。

## Completed Recently

### M005 S06 实施
- [x] 新增 `src/governance/engine.ts`
- [x] 新增 `src/governance/index.ts`
- [x] 新增 `src/governance/engine.test.ts`
- [x] `WorkflowJob` 已支持 `computePool / runId`
- [x] `research executor` 已支持 `pollRunStatus()`
- [x] `research executor` 已支持 `recoverRun()`
- [x] `local_gpu` 已支持 `statusDir / recoveryDir`
- [x] bridge 已支持 `/recover [jobId]`
- [x] `/status` 已支持 research run 状态刷新与 compute pool 展示

### Governance / Gate 收口
- [x] `research_run_request` 已生成 governance report artifacts
- [x] 已支持预算门 / 运行时门 / 安全门 / 发布门结构化记录
- [x] 文章 lane 已落盘 release gate artifacts，而不是默许自动发布
- [x] 研究请求若显式要求联网但当前 sandbox policy 禁止网络，会在治理门被阻断

### 自动化验证
- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] 测试总数提升到 `171`

### Codex trusted-directory compatibility
- [x] `codex` 在非 git working directory 下会自动追加 `--skip-git-repo-check`
- [x] git work tree 内仍保持原始 `codex exec` 调用方式
- [x] 已补 `src/agents/cli-adapter.test.ts` 覆盖 git repo / non-repo 两条路径

### Doctor / Readiness 收口
- [x] `m005-doctor` 现会在 `research.enabled=false` 时返回显式 `warn`
- [x] `m005-doctor` 现会把“启用 research lane”加入 next actions
- [x] README / README_CN 已补 `research` 配置示例与启用说明

### Remote endpoint probe / release-ready support
- [x] 新增 `src/uat/m005-remote-probe.ts`
- [x] 新增 `src/uat/m005-remote-probe.test.ts`
- [x] 新增 `npm run uat:m005-remote-probe`
- [x] 已支持区分 loopback/private endpoint 与公网 endpoint
- [x] 已支持区分 `ECONNREFUSED`、`ETIMEDOUT`、empty-reply / socket-reset 失败
- [x] 2026-04-08 实测公网 `http://119.91.50.158:8081` 为 `ETIMEDOUT`
- [x] 2026-04-08 实测当前本机配置 endpoint `http://127.0.0.1:18081` 为 loopback-only，且在 tunnel 未开启时 `ECONNREFUSED`
- [x] `npm test -- --runInBand --ci src/uat/m005-remote-probe.test.ts`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] 测试总数提升到 `188`

### Nginx public endpoint recovery
- [x] 新增 `deploy/remote-executor/nginx.research-executor.conf.example`
- [x] 云端 `nginx` 已新增 `/research-executor/` -> `127.0.0.1:8081/` reverse proxy
- [x] `curl http://119.91.50.158/research-executor/health` → `200`
- [x] `npm run uat:m005-remote-probe -- --endpoint http://119.91.50.158/research-executor --timeout-ms 4000` → `3 pass / 0 warn / 0 fail`
- [x] 本机 `config.json` 已备份为 `config.json.bak-20260408`
- [x] 本机 `config.json` 已切到 `remote_http=http://119.91.50.158/research-executor`
- [x] `npm run uat:m005-doctor` 现为 `6 pass / 0 warn / 0 fail`
- [x] 真实公网 `submit -> poll -> completed` 已通过 nginx endpoint 验证

### Release-readiness hardening
- [x] `docker-compose` 默认端口发布已改为 `127.0.0.1:8081:8081`
- [x] `templates/config.example.json` 默认 endpoint 已改为 `http://your-server/research-executor`
- [x] deploy / root README 已统一推荐 `/research-executor`，而不是裸露 `:8081`
- [x] systemd 部署文档已补 `wechat` 用户创建步骤
- [x] `m005-doctor` 现会实际探测 `remote_http` health 与 research API 路由，而不是只检查 endpoint 存在
- [x] `src/uat/m005-doctor.test.ts` 已补 reachable / unreachable remote_http 回归
- [x] `npm test -- --runInBand --ci src/uat/m005-doctor.test.ts`
- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] 测试总数提升到 `190`

### Remote HTTP executor bootstrap
- [x] 新增 `src/research/remote-http-server.ts`
- [x] 新增 `src/research/remote-http-server.test.ts`
- [x] 新增 `npm run research:remote-server`
- [x] 已支持 `GET /health`、`POST /research-runs`、`GET /research-runs/:runId`
- [x] 已支持 bearer auth、磁盘持久化、模拟失败与 `/recover` 回归测试
- [x] `npm test -- --runInBand --ci src/research/remote-http-server.test.ts src/research/executor.test.ts`
- [x] `npm test -- --runInBand --ci`
- [x] 测试总数提升到 `176`

### Remote executor deployment assets
- [x] 新增 `deploy/remote-executor/Dockerfile`
- [x] 新增 `deploy/remote-executor/docker-compose.yml`
- [x] 新增 `deploy/remote-executor/docker.env.example`
- [x] 新增 `deploy/remote-executor/wechat-research-remote-executor.service`
- [x] 新增 `deploy/remote-executor/remote-executor.env.example`
- [x] 新增 `deploy/remote-executor/README.md`
- [x] `.env.example` / `templates/config.example.json` 已补 research 相关配置示例
- [x] Docker 路径已补容器级 healthcheck 与独立 env file

### Tencent Cloud remote executor UAT
- [x] 已把当前工作区同步到腾讯云 Ubuntu 22.04 服务器
- [x] 已在云端配置 Docker registry mirror 并成功构建镜像
- [x] `wechat-research-remote-executor` 容器已处于 `healthy`
- [x] 服务器内 `curl http://127.0.0.1:8081/health` 已返回 `200`
- [x] 本机 `config.json` 已切到 `research.enabled=true`
- [x] 本机 `config.json` 已切到 `remote_http=http://127.0.0.1:18081`
- [x] `npm run uat:m005-doctor` 现为 `6 pass / 0 warn / 0 fail`
- [x] 已完成一轮真实 `ResearchExecutor.submitRun() -> pollRunStatus()`，状态到达 `completed`
- [x] 已完成一轮真实微信 `research request -> /approve -> /status`，状态到达 `completed`
- [x] 已完成一轮真实微信失败注入 `research request(模拟失败) -> /approve -> /status -> failed -> /recover [jobId] -> /status -> completed`

### Writing lane artifact sandbox compatibility
- [x] `codex exec` 已支持向 workflow artifact 目录透传 `--add-dir`
- [x] writing / research proposal lane 执行时会把 artifactDir 作为额外可写目录传给 agent
- [x] WeWrite prompt 已收紧为最小读取集，避免递归扫描 skill 目录
- [x] 真实微信 article lane 已生成并落盘 `outline.md` / `draft.md`

### 既有自动化验证
- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `npm test -- --runInBand --ci src/governance/engine.test.ts src/research/executor.test.ts src/commands/handler.test.ts src/bridge/core.test.ts`
- [x] `npm run research:mock-worker -- --once --queue-dir ... --status-dir ...`
- [x] `WECHAT_CLI_BRIDGE_WEWRITE_MOCK_MODE=true node ... WeWriteAdapter.prepareWorkflow(...)`
- [x] `npm run uat:m005-local`
- [x] `npm run uat:m005-bridge`
- [x] `npm run uat:m005-doctor`
- [x] 测试总数提升到 `167`

### 本地 UAT 支撑
- [x] 新增 `src/research/local-gpu-worker.ts`
- [x] 新增 `src/research/local-gpu-worker.test.ts`
- [x] 新增 `npm run research:mock-worker`
- [x] mock worker 会消费 `queueDir`、写回 `statusDir`
- [x] 可通过 `WECHAT_CLI_BRIDGE_MOCK_FAIL_PATTERN` 模拟失败，以验证 `/recover`
- [x] 已完成一轮 queue -> worker -> poll `completed` 的本地 smoke UAT
- [x] 新增 `src/writing/mock-runner.ts`
- [x] 新增 `WECHAT_CLI_BRIDGE_WEWRITE_MOCK_MODE`
- [x] article lane 在 mock mode 下会直接生成 `outline.md` 与 `draft.md`
- [x] 已完成一轮 article lane `completed_local` 的本地 smoke UAT
- [x] 新增 `src/uat/local-m005.ts`
- [x] 新增 `src/uat/local-m005.test.ts`
- [x] 新增 `npm run uat:m005-local`
- [x] article lane 与 research lane 已可一键联跑本地 UAT
- [x] 新增 `src/uat/bridge-m005.ts`
- [x] 新增 `src/uat/bridge-m005.test.ts`
- [x] 新增 `npm run uat:m005-bridge`
- [x] bridge article/research/approve/status 已可一键联跑本地等价 UAT
- [x] 新增 `src/uat/m005-doctor.ts`
- [x] 新增 `src/uat/m005-doctor.test.ts`
- [x] 新增 `npm run uat:m005-doctor`
- [x] doctor 已能输出真实 UAT 缺口：当前只剩 research remote endpoint 未配置

### 真实环境接入进展
- [x] 已完成 `npm run setup`
- [x] iLink 账号已保存到本机 bridge home
- [x] 已克隆 `WeWrite` 到 `~/.openclaw/skills/wewrite`
- [x] 已将 `WeWrite` 依赖安装到私有 `.pydeps`
- [x] 已生成 `config.yaml` / `style.yaml` / `writing-config.yaml`
- [x] bridge 已兼容官方 OpenClaw skill 路径
- [x] `WeWriteAdapter` 在真实 skill + `openclaw` agent 条件下返回 `ready`
- [x] `Bridge.handleMessage(article_create)` 在非 mock 模式下已命中真实 `WeWrite` skill 路径
- [x] writing lane 已支持 `codex` 作为真实执行 fallback
- [x] `codex` 在非 git 工作目录下会自动补 `--skip-git-repo-check`
- [x] `codex` 在真实 writing lane 中会获得 workflow artifact 目录写权限
- [x] 真实微信 article lane 已成功完成一轮 `outline.md` / `draft.md` 落盘 UAT
- [x] `claude` 现需认证可用后才会进入 available agents
- [x] 真实微信 article lane 已验证不再误选 `claude`

### 文档与命令面同步
- [x] 更新 `README.md`
- [x] 更新 `README_CN.md`
- [x] 更新根级 `GSD`
- [x] 新增 `M005/S06-PLAN.md`
- [x] 新增 `M005/S06-UAT.md`

## Active Milestone

**Milestone**: `M005-v1.5-routed-knowledge-workflows`

### Slice Order
- [x] S01 - Semantic Gateway & Job Model
- [x] S02 - PRISM Memory Core
- [x] S03 - Writing Lane / WeWrite Integration
- [x] S04 - Research Proposal Lane
- [x] S05 - Sandboxed Research Execution
- [x] S06 - Governance, Compute & Release Gate

## Key Constraints

1. **当前 `WeWrite` 已安装，但未填真实公众号发布凭据** - article lane 可做真实 skill 写作链验证，但发布/配图会降级
2. **当前 `AI Scientist-v2` 只完成 bridge-side executor / governance / recovery contract，真实执行环境当前由最小 remote_http 服务承接** - 已完成云端部署，并通过 nginx `/research-executor` 收口公网入口
3. **现有 CLI / media / mail 主路径必须保持 release ready** - `M005` 底座不能破坏现有交互
4. **不把凭据写进聊天流或 GSD** - SMTP / research executor 凭据只进本地配置

## Known Limitations

1. **当前 `WeWrite` 未填真实 `wechat.appid/secret` 与图片 API key** - 当前仍会降级为本地 HTML/提示词模式
2. **公网裸露 `:8081` 仍不是推荐入口** - 当前生产形态已改为 nginx `/research-executor/`；若后续要恢复直曝 `:8081`，需单独处理云侧链路问题
3. **本地 research 轮询依赖 worker 将状态写入 `statusDir` 或远端 `/research-runs/:runId`** - 当前 remote contract 已通，公网生产入口现由 nginx 反代承接
4. **发布门当前只做治理记录，不执行真实发布** - 仍保持“草稿 / artifact 先行，外发动作人工确认”

## Next Steps

- [ ] 补齐 `WeWrite` 的 `wechat.appid/secret` 与图片 API key
- [ ] 选择是否继续保留裸露 `:8081` 作为调试入口，或完全以内网 + nginx 反代为正式形态
- [ ] 视需要补一轮真实微信 research re-smoke，作为 release-ready 后的额外确认

## Verification Reality

### Current Re-check (2026-04-08)
```bash
npm run build                # ✅ passed
npm run lint                 # ✅ passed
npm test -- --runInBand --ci # ✅ 190 tests passed
npm run uat:m005-remote-probe -- --endpoint http://119.91.50.158:8081 --timeout-ms 4000
npm run uat:m005-remote-probe -- --timeout-ms 4000
npm run uat:m005-doctor      # ✅ 6 pass / 0 warn / 0 fail
```

### Current Milestone Reality
- `M005-v1.5-routed-knowledge-workflows` 已完成 `S01` 到 `S06`
- `/status` 已支持 compute pool 与 research run 状态刷新
- `/recover [jobId]` 已支持对失败 research run 进行 requeue / resubmit
- `npm run research:mock-worker` 已可用于本地消费 `local_gpu` queue ticket
- `WECHAT_CLI_BRIDGE_WEWRITE_MOCK_MODE=true` 已可用于本地完成 article lane mock UAT
- `npm run uat:m005-local` 已可一键跑通 article + research 本地 mock UAT
- `npm run uat:m005-bridge` 已可一键跑通 bridge 等价 article + research 本地 UAT
- `npm run uat:m005-doctor` 已可输出真实环境 UAT 缺口报告
- `npm run uat:m005-remote-probe` 已可区分公网 endpoint、loopback/tunnel endpoint 与不同网络失败模式
- 腾讯云 Ubuntu 22.04 上已成功运行 `wechat-research-remote-executor`
- 2026-04-08 probe 显示裸露 `http://119.91.50.158:8081/health` 不稳定，但已不再作为 bridge 生产入口
- 当前 bridge 配置 endpoint 已切到 `http://119.91.50.158/research-executor`
- nginx `/research-executor/health` 已返回 `200`
- 经 nginx 入口的受保护 API route probe 已通过
- 经 nginx 入口的真实 `submit -> poll -> completed` 已通过
- 真实 `ResearchExecutor.submitRun() -> pollRunStatus()` 已成功到达 `completed`
- 真实微信 `research request -> /approve -> /status` 已成功到达 `completed`
- 真实微信 `/recover [jobId]` 已成功将 failed research run 恢复到 `completed`
- 真实 `WeWrite` skill 已安装在 `~/.openclaw/skills/wewrite`
- bridge 非 mock 模式下已能识别真实 `WeWrite` skill 并生成 ready prompt
- writing lane 已改为在 `claude/openclaw` 不可用时使用 `codex`
- `codex` 在非 git 工作目录下现会自动补 `--skip-git-repo-check`
- `codex` 已支持向 writing / research artifact 目录透传额外写权限
- WeWrite prompt 已收紧为最小读取集，避免无关目录扫描
- 真实微信 article lane 已成功生成并落盘 `outline.md` / `draft.md`
- governance report / release gate artifacts 已接入 workflow artifact 模型

### Previous Milestone Reality
- `M002-v1.3-rich-delivery` 已达 release ready
- `M003-v1.4-mail-channel` 已达 release ready
- `M004-v1.4.1-natural-mail-intent` 已达 release ready
- `/mail`、`/mailhtml`、`/mailfile` 已通过真实 SMTP 收件箱 UAT
- 自然语言纯文本邮件已通过真实微信会话与真实 SMTP 收件箱 UAT
