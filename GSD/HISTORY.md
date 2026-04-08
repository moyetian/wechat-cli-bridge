# History: WeChat CLI Bridge Development

## 2026-04-08

### Task: release-readiness hardening for deployment defaults and doctor
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已修复 3 个中等级别的 release-readiness 问题：公开部署默认入口改为 nginx `/research-executor`，systemd 文档补齐 `wechat` 用户创建步骤，`m005-doctor` 现会实际探测 `remote_http` endpoint；全量测试提升到 `190`
- **Scope**: deploy defaults、doctor probe、README / template sync、tests

### Subtask: deploy defaults aligned to nginx public endpoint
- **Status**: Complete
- **Files**:
  - `deploy/remote-executor/docker-compose.yml`
  - `deploy/remote-executor/README.md`
  - `templates/config.example.json`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - `docker-compose` 默认端口发布已改为 `127.0.0.1:8081:8081`
  - config / README 默认公网入口已统一到 `http://your-server/research-executor`
  - probe 示例已不再默认指向裸露 `:8081`

### Subtask: doctor remote_http validation tightened
- **Status**: Complete
- **Files**:
  - `src/uat/m005-doctor.ts`
  - `src/uat/m005-doctor.test.ts`
- **Changes**:
  - `m005-doctor` 现会实际检查 `remote_http` health 与 research API route
  - reachable remote endpoint 才会给 `research_lane=pass`
  - unreachable remote endpoint 现在会给 `fail` 并提示运行 `m005-remote-probe`
- **Verification**:
  - `npm test -- --runInBand --ci src/uat/m005-doctor.test.ts` → passed
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm run uat:m005-doctor` → 6 pass / 0 warn / 0 fail
  - `npm run uat:m005-remote-probe -- --timeout-ms 4000` → 3 pass / 0 warn / 0 fail
  - `npm test -- --runInBand --ci` → 190 tests passed

### Task: v1.5.0 release packaging
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已将运行时与发布文档口径统一到 `v1.5.0`，并补齐根级 `CHANGELOG.md`，可直接作为 GitHub release 基础材料
- **Scope**: package version、startup banner、channel version、README、CHANGELOG、GSD sync

### Subtask: runtime version sync
- **Status**: Complete
- **Files**:
  - `package.json`
  - `package-lock.json`
  - `src/index.ts`
  - `src/bridge/ilink-client.ts`
- **Changes**:
  - 将 npm package version 从 `1.4.1` 提升到 `1.5.0`
  - 将启动 banner 切到 `v1.5.0`
  - 将 channel version fallback 切到 `1.5.0`

### Subtask: release docs sync
- **Status**: Complete
- **Files**:
  - `README.md`
  - `README_CN.md`
  - `CHANGELOG.md`
  - `GSD/PROJECT.md`
  - `GSD/STATE.md`
  - `GSD/projects/wechat-cli-bridge.md`
  - `GSD/sessions/SESSION-2026-04-08.md`
- **Changes**:
  - README 首页状态已补 `v1.5.0 release ready`
  - README / README_CN 当前测试数已从 `121` 校正到 `188`
  - 新增根级 `CHANGELOG.md`
  - GSD 已同步“运行时版本口径 = `v1.5.0`”

### Task: M005 public endpoint recovery via nginx reverse proxy
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已将公网 remote executor 入口从不稳定的裸露 `:8081` 收口为稳定的 `http://119.91.50.158/research-executor`，并完成配置切换、probe、doctor 与真实 `submit -> poll -> completed` 验证；`M005` 可标记为 release ready
- **Scope**: nginx reverse proxy、bridge config switch、public probe、real submit/poll、GSD sync

### Subtask: nginx reverse proxy rollout
- **Status**: Complete
- **Files**:
  - `deploy/remote-executor/nginx.research-executor.conf.example`
  - `deploy/remote-executor/README.md`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 仓库新增 nginx 反代示例，把 `/research-executor/` 指向 `127.0.0.1:8081`
  - 云端 `wechat-previews` 站点已增加 `/research-executor/` location
  - 裸露 `:8081` 不再作为推荐公网入口
- **Verification**:
  - 云端 `curl http://127.0.0.1/research-executor/health` → passed
  - 本机 `curl http://119.91.50.158/research-executor/health` → passed

### Subtask: local config switch and real path verification
- **Status**: Complete
- **Files**:
  - `GSD/PROJECT.md`
  - `GSD/ROADMAP.md`
  - `GSD/STATE.md`
  - `GSD/HISTORY.md`
  - `GSD/projects/wechat-cli-bridge.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/ROADMAP.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/S06-UAT.md`
  - `GSD/sessions/SESSION-2026-04-08.md`
- **Changes**:
  - 本机 `config.json` 已备份并把 endpoint 从 `http://127.0.0.1:18081` 切到 `http://119.91.50.158/research-executor`
  - `m005-remote-probe` 现以真实 bridge 配置跑通 `3 pass / 0 warn / 0 fail`
  - `m005-doctor` 现以真实 bridge 配置跑通 `6 pass / 0 warn / 0 fail`
  - 新公网入口已完成一轮真实 `submit -> poll -> completed`
  - 根级与 milestone GSD 已同步到 `M005 release ready`
- **Verification**:
  - `npm run uat:m005-remote-probe -- --timeout-ms 4000` → 3 pass / 0 warn / 0 fail
  - `npm run uat:m005-doctor` → 6 pass / 0 warn / 0 fail
  - 真实公网 run `nginx-probe-...` → `queued -> running -> completed`

### Task: M005 remote endpoint probe and release gate diagnosis
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已新增 `m005-remote-probe`，把“公网 8081 不可达”从口头现象收敛为可重复执行的诊断命令，并在 2026-04-08 实测确认公网 `119.91.50.158:8081` 当前为 `ETIMEDOUT`，而本机 `127.0.0.1:18081` 仅是 loopback/tunnel endpoint，且在 tunnel 未开启时返回 `ECONNREFUSED`
- **Scope**: remote probe script、tests、README / deploy docs、GSD sync

### Subtask: remote probe command and tests
- **Status**: Complete
- **Files**:
  - `src/uat/m005-remote-probe.ts`
  - `src/uat/m005-remote-probe.test.ts`
  - `package.json`
- **Changes**:
  - 新增 `npm run uat:m005-remote-probe`
  - 已支持探测 `GET /health` 与受保护 API 路由
  - 已支持区分 loopback/private endpoint 与公网 endpoint
  - 已支持分类 `ECONNREFUSED`、`ETIMEDOUT`、empty-reply / socket-reset 失败
- **Verification**:
  - `npm test -- --runInBand --ci src/uat/m005-remote-probe.test.ts` → passed
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 188 tests passed

### Subtask: live probe result and docs sync
- **Status**: Complete
- **Files**:
  - `README.md`
  - `README_CN.md`
  - `deploy/remote-executor/README.md`
  - `GSD/PROJECT.md`
  - `GSD/ROADMAP.md`
  - `GSD/STATE.md`
  - `GSD/HISTORY.md`
  - `GSD/projects/wechat-cli-bridge.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/S06-UAT.md`
  - `GSD/sessions/SESSION-2026-04-08.md`
- **Changes**:
  - README 与部署文档新增 remote endpoint probe 用法
  - 根级与 milestone GSD 已同步到“research UAT 已通过，当前 blocker 是公网直连与 release gate”
  - 记录 2026-04-08 实测：公网 `http://119.91.50.158:8081/health` 为 `ETIMEDOUT`
  - 记录 2026-04-08 实测：当前配置 endpoint `http://127.0.0.1:18081` 为 loopback-only，且在 tunnel 未开启时 `ECONNREFUSED`

## 2026-04-07

### Task: Tencent Cloud remote executor live deployment
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已将最小 `remote_http` executor 实际部署到腾讯云 Ubuntu 22.04 + Docker，并完成一轮真实 submit/poll 联调；当前 bridge 已通过 SSH tunnel 接入云端 executor
- **Scope**: 云端同步、Docker 构建、容器启动、health check、本机 config 切换、doctor 复检、真实 submit/poll UAT

### Subtask: cloud deployment and tunnel fallback
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-04-07.md`
- **Changes**:
  - 已将当前工作区同步到腾讯云服务器
  - 已配置 Docker registry mirror 并成功构建 `wechat-research-remote-executor`
  - 容器已启动并通过内网 `health` 检查
  - 已将本机 `config.json` 备份并切到 `research.enabled=true + remote_http`
  - 因公网 `8081` 仍返回 empty reply，当前 bridge 改为通过 SSH tunnel 连接云端 executor
- **Verification**:
  - 腾讯云内 `curl http://127.0.0.1:8081/health` → passed
  - `npm run uat:m005-doctor` → 6 pass / 0 warn / 0 fail
  - 真实 `ResearchExecutor.submitRun() -> pollRunStatus()` → completed

### Subtask: real WeChat research run and recovery UAT
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/HISTORY.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/S06-UAT.md`
  - `GSD/sessions/SESSION-2026-04-07.md`
- **Changes**:
  - 已在真实微信会话中完成一轮 `research request -> /approve -> /status`
  - 已通过云端 fail-pattern 注入一轮真实 `failed` research run
  - 已在真实微信会话中完成一轮 `/recover [jobId] -> /status`
  - 将根级与 milestone `GSD` 更新到“真实 research 与 recovery UAT 已通过，公网直连仍待修复”
- **Verification**:
  - 真实微信 research run：job `4d2b25e9-a12c-4a0d-bc04-8848e55fdf8b` → `completed`
  - 真实微信 recovery run：job `4aa526be-1777-4692-9639-aa5b69dfae89` → `failed -> recovered -> completed`

### Task: M005 minimal remote executor bootstrap
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已为 `remote_http` 路径补上最小可运行 executor 服务骨架，使下一步可以直接转入云端部署与真实 research UAT，而不再停留在 bridge-side contract
- **Scope**: remote executor service、CLI script、tests、README / GSD sync

### Subtask: remote_http executor service
- **Status**: Complete
- **Files**:
  - `src/research/remote-http-server.ts`
  - `src/research/remote-http-server.test.ts`
  - `src/research/index.ts`
  - `package.json`
- **Changes**:
  - 新增最小 `remote_http` executor 服务，支持 `GET /health`、`POST /research-runs`、`GET /research-runs/:runId`
  - 服务会持久化 request / queue / status / result JSON，并内置简单 worker loop
  - 已支持可选 bearer auth 与 fail-pattern，便于 `/recover` 验证
  - 新增 `npm run research:remote-server`
- **Verification**:
  - `npm test -- --runInBand --ci src/research/remote-http-server.test.ts src/research/executor.test.ts` → passed
  - `npm run build` → passed
  - `npm test -- --runInBand --ci` → 176 tests passed

### Subtask: remote executor deployment assets
- **Status**: Complete
- **Files**:
  - `.dockerignore`
  - `.env.example`
  - `templates/config.example.json`
  - `deploy/remote-executor/Dockerfile`
  - `deploy/remote-executor/docker-compose.yml`
  - `deploy/remote-executor/docker.env.example`
  - `deploy/remote-executor/wechat-research-remote-executor.service`
  - `deploy/remote-executor/remote-executor.env.example`
  - `deploy/remote-executor/README.md`
  - `README.md`
  - `README_CN.md`
  - `GSD/STATE.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-04-07.md`
- **Changes**:
  - 补齐 Docker、Compose、systemd、env-file 与上线说明
  - Docker 路径改为独立 `docker.env` 管理密钥，并补容器 healthcheck
  - 为根级环境示例与配置模板补齐 research remote executor 配置
  - 将根级文档与 GSD 更新到“已具备部署产物，待云端接线”状态

### Task: M005 doctor readiness correction
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已校正 `m005-doctor` 对 research lane 的 readiness 判断，避免在 `research.enabled=false` 时误报为 ready；同时补齐 README 配置示例与 GSD 记录，使下一步真实 research worker 接入更明确
- **Scope**: doctor 判定逻辑、doctor 测试、README 配置示例、GSD 状态同步

### Subtask: research disabled doctor guard
- **Status**: Complete
- **Files**:
  - `src/uat/m005-doctor.ts`
  - `src/uat/m005-doctor.test.ts`
- **Changes**:
  - `m005-doctor` 现在会在 `research.enabled=false` 时返回显式 `warn`
  - `nextActions` 现会提示先启用 `research.enabled`
  - 新增回归测试，覆盖“executor 配置存在但 research 仍 disabled”的场景
- **Verification**:
  - `npm test -- --runInBand --ci src/uat/m005-doctor.test.ts` → passed
  - `npm run build` → passed

### Subtask: research config docs sync
- **Status**: Complete
- **Files**:
  - `README.md`
  - `README_CN.md`
  - `GSD/STATE.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-04-07.md`
- **Changes**:
  - 为 README / README_CN 的配置示例补齐 `research` 段
  - 增加 `research.enabled`、`remote_http`、`local_gpu` 的启用说明
  - 将根级 `STATE` 更新到“真实下一步 = 启用 research + 接入真实 worker/endpoint”

## 2026-04-05

### Task: M005 real article lane trusted-directory compatibility
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已为 `codex` 非 git 工作目录执行路径补齐 trusted-directory 兼容，使真实微信 article lane 的 blocker 从“代码层错误”推进为“待实机复测”
- **Scope**: `codex exec` 调用兼容、单测补强、build/lint/full test 回归、GSD 状态同步

### Subtask: codex repo-check compatibility
- **Status**: Complete
- **Files**:
  - `src/agents/cli-adapter.ts`
  - `src/agents/cli-adapter.test.ts`
- **Changes**:
  - 为 `codex exec` 增加 git work tree 预检
  - 当 `workingDir` 不在 git 仓库内时，自动追加 `--skip-git-repo-check`
  - 保持 git repo 内的调用参数不变，避免扩大默认绕过范围
- **Verification**:
  - `npm test -- --runInBand --ci src/agents/cli-adapter.test.ts src/agents/cli-permissions.test.ts` → passed
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 171 tests passed

### Subtask: GSD status refresh
- **Status**: Complete
- **Files**:
  - `GSD/PROJECT.md`
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/HISTORY.md`
  - `GSD/projects/wechat-cli-bridge.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/ROADMAP.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/S06-UAT.md`
  - `GSD/sessions/SESSION-2026-04-05.md`
- **Changes**:
  - 将根级状态从“trusted-directory blocker”更新为“代码已修复，待真实 article lane 复测”
  - 修正 `M005` 文档中关于真实 WeWrite 安装状态的过期描述
  - 将最新测试总数同步为 `171`

### Subtask: real article lane UAT closure
- **Status**: Complete
- **Files**:
  - `src/types/index.ts`
  - `src/agents/cli-adapter.ts`
  - `src/agents/cli-adapter.test.ts`
  - `src/writing/contract.ts`
  - `src/writing/wewrite-adapter.ts`
  - `src/writing/wewrite-adapter.test.ts`
  - `src/research/contract.ts`
  - `src/research/proposal-adapter.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 为 agent 执行选项增加 `writableDirs`
  - `codex exec` 已支持向 workflow artifact 目录追加 `--add-dir`
  - writing / research proposal lane 会将 artifactDir 透传给 agent
  - WeWrite prompt 已收紧为最小读取集，避免无关目录扫描拖慢真实 UAT
  - 在真实微信会话中已成功完成 article lane，生成并落盘 `outline.md` / `draft.md`
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 172 tests passed
  - 真实微信 article lane UAT：job `877be380-b947-4137-af2a-77553cdaf7e5` → `completed`

## 2026-03-31

### Task: M005 S06 Governance, Compute & Release Gate
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已为 `M005` 落地 governance / compute / release gate 第一版，并把 research workflow 的状态轮询与失败恢复接入 bridge
- **Scope**: governance engine、compute pool、executor polling / recovery、`/status`、`/recover`、tests、GSD / README sync

### Subtask: governance engine 与 compute pool
- **Status**: Complete
- **Files**:
  - `src/governance/engine.ts`
  - `src/governance/index.ts`
  - `src/governance/engine.test.ts`
  - `src/types/index.ts`
  - `src/context/manager.ts`
- **Changes**:
  - 定义 budget / runtime / safety / release gate 评估
  - 定义 `wechat_realtime / writing_batch / research_sandbox` compute pool
  - 为 workflow job 增加 `computePool / runId`
  - 已支持 governance report / release gate artifacts 落盘

### Subtask: executor 状态轮询与恢复
- **Status**: Complete
- **Files**:
  - `src/research/executor.ts`
  - `src/research/executor.test.ts`
  - `src/setup.ts`
- **Changes**:
  - `local_gpu` 新增 `statusDir / recoveryDir`
  - 已支持 `pollRunStatus()`
  - 已支持 `recoverRun()`
  - 已定义 remote `/research-runs/:runId` 与 local status file contract

### Subtask: bridge 集成与命令面同步
- **Status**: Complete
- **Files**:
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
  - `src/commands/handler.ts`
  - `src/commands/handler.test.ts`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - `/status` 会刷新 research run 状态并显示 compute pool
  - 新增 `/recover [jobId]`
  - research governance blocked path 会阻止不符合 sandbox policy 的请求
  - 文档已同步新命令与治理边界
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 161 tests passed

### Subtask: local_gpu mock worker for local UAT
- **Status**: Complete
- **Files**:
  - `src/research/local-gpu-worker.ts`
  - `src/research/local-gpu-worker.test.ts`
  - `src/research/index.ts`
  - `package.json`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 新增可运行的 `local_gpu` mock worker
  - 已支持消费 queue ticket、写回 `statusDir`
  - 已支持 `WECHAT_CLI_BRIDGE_MOCK_FAIL_PATTERN` 模拟失败
  - 已新增 `npm run research:mock-worker`
- **Verification**:
  - `npm run research:mock-worker -- --once --queue-dir /tmp/... --status-dir /tmp/...` → passed
  - `npm test -- --runInBand --ci src/research/local-gpu-worker.test.ts` → passed
  - 本地 smoke UAT：submit queue -> worker consume -> poll completed → passed

### Subtask: WeWrite mock mode for local article lane UAT
- **Status**: Complete
- **Files**:
  - `src/writing/mock-runner.ts`
  - `src/writing/wewrite-adapter.ts`
  - `src/writing/wewrite-adapter.test.ts`
  - `src/writing/contract.ts`
  - `src/writing/index.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 新增 `WECHAT_CLI_BRIDGE_WEWRITE_MOCK_MODE`
  - article workflow 在 mock mode 下会直接生成 outline / draft
  - bridge 会将 writing workflow 标记为 `completed`
  - 用于本地 article lane UAT，不替代真实 WeWrite
- **Verification**:
  - `npm test -- --runInBand --ci src/writing/wewrite-adapter.test.ts src/bridge/core.test.ts` → passed
  - 本地 smoke UAT：mock mode -> prepareWorkflow -> outline/draft generated → passed
  - `npm test -- --runInBand --ci` → 164 tests passed

### Subtask: one-command local M005 mock UAT runner
- **Status**: Complete
- **Files**:
  - `src/uat/local-m005.ts`
  - `src/uat/local-m005.test.ts`
  - `package.json`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 新增 `npm run uat:m005-local`
  - 一次性执行 article lane mock UAT 与 research lane mock UAT
  - 自动输出 report、artifactDir、queueDir、statusDir
- **Verification**:
  - `npm test -- --runInBand --ci src/uat/local-m005.test.ts src/writing/wewrite-adapter.test.ts src/research/local-gpu-worker.test.ts` → passed
  - `npm run uat:m005-local` → passed

### Subtask: bridge-equivalent local M005 UAT harness
- **Status**: Complete
- **Files**:
  - `src/uat/bridge-m005.ts`
  - `src/uat/bridge-m005.test.ts`
  - `package.json`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 新增 `npm run uat:m005-bridge`
  - 通过 `Bridge.handleMessage()` 驱动 article、research、`/approve`、mock worker、`/status`
  - 会保存 transcript 与 markdown report
- **Verification**:
  - `npm test -- --runInBand --ci src/uat/bridge-m005.test.ts src/uat/local-m005.test.ts` → passed
  - `npm run uat:m005-bridge` → passed
  - `npm test -- --runInBand --ci` → 167 tests passed

### Subtask: M005 doctor and real-UAT readiness report
- **Status**: Complete
- **Files**:
  - `src/uat/m005-doctor.ts`
  - `src/uat/m005-doctor.test.ts`
  - `package.json`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 新增 `npm run uat:m005-doctor`
  - 检查 bridge config、iLink 凭据、WeWrite、writing agents、research runtime、local UAT runner
  - 会输出 markdown report 与 next actions
  - 已在当前环境识别出缺少 `config.json`、iLink 凭据与真实 WeWrite
- **Verification**:
  - `npm test -- --runInBand --ci src/uat/m005-doctor.test.ts src/uat/bridge-m005.test.ts src/uat/local-m005.test.ts` → passed
  - `npm run uat:m005-doctor` → passed
  - `npm test -- --runInBand --ci` → 167 tests passed

### Subtask: WeWrite official OpenClaw install path compatibility
- **Status**: Complete
- **Files**:
  - `src/writing/wewrite-adapter.ts`
- **Changes**:
  - 将 `~/.openclaw/skills/wewrite` 与 Windows 对应路径加入默认 WeWrite 探测列表
  - 避免按官方 README 安装后 bridge 仍无法自动识别 skill
- **Verification**:
  - `npm run build` → passed
  - `npm test -- --runInBand --ci src/writing/wewrite-adapter.test.ts` → passed

### Subtask: WeWrite real installation and bridge-ready verification
- **Status**: Complete
- **Files**:
  - `/home/moyetian/.openclaw/skills/wewrite`
  - `/home/moyetian/.openclaw/skills/wewrite/config.yaml`
  - `/home/moyetian/.openclaw/skills/wewrite/style.yaml`
  - `src/writing/wewrite-adapter.ts`
  - `src/writing/wewrite-adapter.test.ts`
- **Changes**:
  - 完成 `npm run setup`，bridge account 已写入本机 home
  - 已克隆官方 `WeWrite` 到 OpenClaw skill 路径
  - 已将 Python 依赖安装到 skill 私有 `.pydeps`
  - 已生成最小可运行配置，并将 bridge prompt 改为优先使用 skill 私有依赖
  - 已验证 `WeWriteAdapter` 在真实 skill + `openclaw` 条件下返回 `ready`
- **Verification**:
  - `cd ~/.openclaw/skills/wewrite && PYTHONPATH=.pydeps python3 scripts/diagnose.py --json` → passed
  - `node ... WeWriteAdapter.prepareWorkflow(... openclaw ...)` → status=`ready`
  - `node ... Bridge.handleMessage("写一篇关于 AI Agent 控制平面的公众号文章")` → job=`completed`, prompt contains real WeWrite path

### Subtask: codex fallback for real WeWrite writing lane
- **Status**: Complete
- **Files**:
  - `src/agents/index.ts`
  - `src/agents/cli-adapter.ts`
  - `src/agents/cli-adapter.test.ts`
  - `src/agents/cli-permissions.test.ts`
  - `src/writing/wewrite-adapter.ts`
  - `src/writing/wewrite-adapter.test.ts`
  - `src/bridge/core.test.ts`
  - `src/uat/m005-doctor.ts`
- **Changes**:
  - `claude` 可用性从“命令存在”升级为“命令存在且已认证/API key 可用”
  - writing lane 新增 `codex` 作为正式 fallback
  - `codex` 默认调用方式改为 `codex exec [PROMPT]`
  - 已验证真实微信 article lane 不再误选 `claude`
- **Verification**:
  - `npm run build` → passed
  - `npm test -- --runInBand --ci src/agents/cli-permissions.test.ts src/agents/cli-adapter.test.ts src/writing/wewrite-adapter.test.ts src/bridge/core.test.ts src/uat/m005-doctor.test.ts` → passed
  - 真实微信 article lane 最新错误已推进为 `Not inside a trusted directory and --skip-git-repo-check was not specified`

## 2026-03-30

### Task: M005 S05 Sandboxed Research Execution
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已为 `M005` 落地 research executor skeleton，并把批准后的 `research_run_request` 接入 `remote_http / local_gpu` 双后端 submission
- **Scope**: executor contract、runtime config、submission artifacts、bridge approval integration、tests、GSD sync

### Subtask: research executor 与 runtime config
- **Status**: Complete
- **Files**:
  - `src/research/executor.ts`
  - `src/research/executor.test.ts`
  - `src/research/index.ts`
  - `src/types/index.ts`
  - `src/index.ts`
  - `src/setup.ts`
- **Changes**:
  - 定义 research executor config
  - 支持 `remote_http / local_gpu`
  - 接入默认 research 配置到运行时和 setup

### Subtask: 批准后 submission 接线
- **Status**: Complete
- **Files**:
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - `research_run_request` 经批准后会真正调用 `ResearchExecutor.submitRun()`
  - 已落盘 run manifest / runtime config / executor request / queue ticket
  - local backend 会写入 queue ticket，remote backend 未配置时返回 integration-missing
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 150 tests passed

### Task: M005 S04 Research Proposal Lane
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已为 `M005` 落地 research proposal lane，并把 `research_idea / research_plan` 接入 proposal artifacts 与执行链
- **Scope**: research adapter、proposal artifacts、bridge integration、tests、GSD sync

### Subtask: research proposal adapter 与 artifacts
- **Status**: Complete
- **Files**:
  - `src/research/contract.ts`
  - `src/research/proposal-adapter.ts`
  - `src/research/index.ts`
  - `src/research/proposal-adapter.test.ts`
- **Changes**:
  - 定义 research workflow preparation contract
  - 已落盘 `research_brief` / `research_proposal` / `research_novelty_check` / `research_budget_estimate` / `research_task`
  - prompt 已明确禁止直接启动真实实验

### Subtask: bridge proposal lane 集成
- **Status**: Complete
- **Files**:
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 已支持 `research_idea / research_plan` 进入 proposal lane
  - 可直接调用现有 agent 生成 proposal / novelty / budget 草稿
  - `research_run_request` 仍保留给后续 sandbox execution
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 147 tests passed

### Task: M005 S03 Writing Lane / WeWrite Integration
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已为 `M005` 落地 article workflow artifact model、WeWrite adapter 和 writing lane 执行接线；当本机未安装 WeWrite 时会明确提示并保留 workflow artifact
- **Scope**: writing adapter、artifact persistence、bridge integration、tests、GSD sync

### Subtask: WeWrite adapter 与 article artifacts
- **Status**: Complete
- **Files**:
  - `src/writing/contract.ts`
  - `src/writing/wewrite-adapter.ts`
  - `src/writing/index.ts`
  - `src/writing/wewrite-adapter.test.ts`
- **Changes**:
  - 定义 writing workflow preparation contract
  - 支持 WeWrite skill 路径探测
  - 支持 `claude / openclaw` writing lane agent 选择
  - 已落盘 `article_brief` / `wewrite_task` / `article_outline` / `article_draft`

### Subtask: bridge 写作 lane 集成
- **Status**: Complete
- **Files**:
  - `src/context/manager.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 已支持 `article_create / article_edit` 进入 writing lane
  - skill 缺失时会创建 job + artifacts 并给出明确提示
  - skill 可用且存在 `claude` agent 时会直接触发 writing lane 执行
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 145 tests passed

### Task: M005 S02 PRISM Memory Core
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已为 `M005` 落地第一版 PRISM memory substrate，并把 `quick / standard / deep` 分层上下文接入 `/context` 与 CLI agent 执行路径
- **Scope**: memory contract、profile selector、memory bundle、bridge integration、tests、GSD sync

### Subtask: memory contract 与 core 实施
- **Status**: Complete
- **Files**:
  - `src/memory/contract.ts`
  - `src/memory/core.ts`
  - `src/memory/index.ts`
  - `src/memory/core.test.ts`
- **Changes**:
  - 定义 `MemoryLoadProfile`、`MemoryEntry`、`MemoryBundle`
  - 新增 `selectMemoryLoadProfile()`
  - 新增 `PRISMMemoryCore`
  - 将 memory 分为 `hot / warm / cold`

### Subtask: bridge 接入与验证
- **Status**: Complete
- **Files**:
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - `/context` 已输出 `standard` 档 PRISM memory
  - CLI agent 执行已注入 `PRISM Memory (...)` 上下文
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 141 tests passed

### Task: M005 S01 Semantic Gateway & Job Model
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已为 `M005` 落地 workflow route / lane / gate / job 底座，并把 workflow gateway 接入 bridge 主流程
- **Scope**: routing layer、workflow state model、bridge integration、tests、GSD sync

### Subtask: routing 与 workflow 契约
- **Status**: Complete
- **Files**:
  - `src/types/index.ts`
  - `src/routing/contract.ts`
  - `src/routing/router-adapter.ts`
  - `src/routing/gateway.ts`
  - `src/routing/index.ts`
- **Changes**:
  - 定义 `WorkflowRouteName`、`WorkflowLane`、`WorkflowGateLevel`
  - 定义 `WorkflowRouteDecision`、`WorkflowJob`、`WorkflowArtifact`
  - 定义 route catalog 与启发式 router adapter

### Subtask: workflow job 持久化与 bridge 集成
- **Status**: Complete
- **Files**:
  - `src/context/manager.ts`
  - `src/context/manager.test.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 为 `ContextState` 增加 `workflowJobs` / `workflowArtifacts`
  - 新增 workflow job 创建、查询、审批状态同步
  - 在 `handleTask()` 中接入 routing gateway
  - `article_* / research_* / status_query` 已与 `general_cli_task` 分流
  - 高风险 `research_run_request` 进入审批流，但当前仍不直接触发研究执行器
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 137 tests passed

### Subtask: M005 active 切换与 slice 文档
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/PROJECT.md`
  - `GSD/projects/wechat-cli-bridge.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-30.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/README.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/ROADMAP.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/S01-PLAN.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/S01-UAT.md`
- **Result**:
  - `M005` 已从 candidate 切到 active milestone
  - `S01` 已标记为 implemented
  - 当前下一步明确为 `S02 PRISM Memory Core`

### Task: M005 Candidate Planning Captured
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已把“微信前门 + semantic-router + PRISM memory + WeWrite + AI Scientist-v2”的完整规划写入 GSD，作为 `M005-v1.5-routed-knowledge-workflows` 候选里程碑
- **Scope**: future milestone planning、root GSD sync、external reference role mapping

### Subtask: 候选里程碑文档
- **Status**: Complete
- **Files**:
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/README.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/ROADMAP.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/CONTEXT.md`
  - `GSD/milestones/M005-v1.5-routed-knowledge-workflows/RESEARCH.md`
- **Changes**:
  - 定义 `general cli lane`、`writing lane`、`research lane`
  - 定义 PRISM 三层：logic / gateway / compute
  - 定义 `S01` 到 `S06` 的切片顺序和边界
  - 把 `semantic-router`、`mem0`、`prism-mcp`、`WeWrite`、`AI Scientist-v2` 的职责映射清楚

### Subtask: 根级 GSD 同步
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/PROJECT.md`
  - `GSD/projects/wechat-cli-bridge.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-30.md`
- **Result**:
  - 当前 active milestone 仍保持 `M004 release ready`
  - `M005` 被明确记录为 next candidate，而不是误记为 active

### Task: M004 S01/S02 Natural Mail Intent And Docs Sync
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已为 SMTP 邮件通道增加自然语言纯文本邮件入口，并将根级 GSD 从 `v1.4.0` 漂移状态纠正到当前 `v1.4.1` 口径
- **Scope**: natural mail parser、bridge integration、help text、README、GSD 文档

### Subtask: 自然语言邮件意图解析
- **Status**: Complete
- **Files**:
  - `src/mail/natural-intent.ts`
  - `src/mail/natural-intent.test.ts`
  - `src/mail/index.ts`
- **Changes**:
  - 新增自然语言纯文本邮件解析器
  - 仅在消息中包含明确邮件动作 + 主题/正文标签时触发，避免误拦截普通任务
  - 支持显式收件人和 `mail.defaultTo` fallback
  - 缺少收件人/主题/正文时会追问
- **Verification**:
  - `npm test -- --runInBand --ci src/mail/natural-intent.test.ts` → passed

### Subtask: Bridge 集成与帮助文案
- **Status**: Complete
- **Files**:
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
  - `src/commands/handler.ts`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 在非命令消息路径中接入自然语言邮件分支
  - 命中自然语言邮件时直接发信，不启动 agent
  - 为帮助文案与 README 补充自然语言邮件示例与 `mail.defaultTo` 说明
- **Verification**:
  - `npm test -- --runInBand --ci src/mail/natural-intent.test.ts src/bridge/core.test.ts src/commands/handler.test.ts` → passed
  - `npm run build` → passed
  - `npm run lint` → passed

### Subtask: GSD 记录与版本口径纠偏
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-30.md`
  - `GSD/milestones/M003-v1.4-mail-channel/README.md`
  - `GSD/milestones/M004-v1.4.1-natural-mail-intent/*`
- **Result**:
  - 修正根级 GSD 对实际版本仍停留在 `v1.4.0` 的漂移
  - 新建 `M004-v1.4.1-natural-mail-intent`
  - 将当前下一步明确为真实 inbox UAT 与 release gate

### Task: M004 S03 Real Inbox UAT, Setup Fix And Release Gate
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已完成自然语言邮件的真实微信/真实收件箱 UAT，修复 `setup` 覆盖 `mail` 配置的问题，并将 `M004` 标记为 `v1.4.1` release ready
- **Scope**: real WeChat UAT、real SMTP inbox UAT、setup hardening、GSD 收口

### Subtask: 真实微信与真实收件箱 UAT
- **Status**: Complete
- **Environment**:
  - 本地 UAT home: `/tmp/wcb-uat-home`
  - 发信链路: Gmail SMTP
  - 收件箱: QQ Mail
  - 微信会话: `cd0d19808fb9@im.bot`
- **Observed Result**:
  - 显式收件人自然语言邮件 → 成功发送
  - `mail.defaultTo` fallback → 成功发送
  - 缺失正文 → 在真实微信会话中正确追问

### Subtask: setup 配置覆盖修复
- **Status**: Complete
- **Files**:
  - `src/setup.ts`
- **Changes**:
  - 保留已有 `workingDirectory`、`defaultAgent`、`media`、`permission`
  - 重新保存配置时保留已有 `mail` 段，不再把 SMTP 配置覆盖成默认空值
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 128 tests passed

### Subtask: M004 release gate 收口
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-30.md`
  - `GSD/milestones/M004-v1.4.1-natural-mail-intent/*`
- **Result**:
  - `M004` 已从 in progress 切到 release ready
  - 当前决定继续维持“HTML/附件邮件走显式命令”的边界

## 2026-03-29

### Task: M003 S05 Release Gate And Real Inbox UAT
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已完成真实 SMTP 收件箱 UAT、命令兼容性补强和 `v1.4.0` 版本收口
- **Scope**: SMTP UAT、bridge mail UX、版本口径、README、GSD 根文档、milestone 文档

### Subtask: 文档与模板同步
- **Status**: Complete
- **Files**:
  - `README.md`
  - `README_CN.md`
  - `templates/config.example.json`
  - `GSD/milestones/M003-v1.4-mail-channel/S05-PLAN.md`
  - `GSD/milestones/M003-v1.4-mail-channel/S05-UAT.md`
  - `GSD/milestones/M003-v1.4-mail-channel/RELEASE-CHECKLIST.md`
  - `GSD/milestones/M003-v1.4-mail-channel/README.md`
  - `GSD/milestones/M003-v1.4-mail-channel/ROADMAP.md`
- **Changes**:
  - 补齐 `M003 S05` 的 plan、UAT 与 release checklist
  - 为 README / README_CN 补充 SMTP 配置说明
  - 将 `templates/config.example.json` 同步到当前 `media` / `mail` 结构
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 118 tests passed

### Subtask: SMTP UAT 准备审计
- **Status**: Complete
- **Environment**:
  - 脱敏检查 `/tmp/wcb-uat-home/config.json`
  - 脱敏检查 `/tmp/wechat-cli-bridge-verify/config.json`
  - 脱敏检查 `/mnt/c/Users/Administrator/.wechat-cli-bridge/config.json`
- **Observed Result**:
  - 当前三处配置都没有启用且完整的 SMTP 凭据
  - 真实收件箱 UAT 仍待用户提供测试账号

### Subtask: 真实 SMTP 收件箱 UAT
- **Status**: Complete
- **Environment**:
  - 本地 UAT home: `/tmp/wcb-uat-home`
  - 发信链路: Gmail SMTP
  - 收件箱: QQ Mail
- **Observed Result**:
  - `/mail` → 收到纯文本邮件
  - `/mailhtml` → 收到 HTML 邮件
  - `/mailfile` → 收到附件邮件
  - direct SMTP probe 也已成功收到 HTML-only 与附件邮件

### Subtask: mail UX 兼容性补强
- **Status**: Complete
- **Files**:
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 为 `/mailhtml` 增加 plain-text fallback，避免部分收件端只吃 `text/html` 时表现不稳
  - 为 `/mailfile` 的附件准备失败补充解析后的绝对路径
- **Verification**:
  - `npm test -- --runInBand --ci src/bridge/core.test.ts` → passed
  - `npm run build` → passed

### Subtask: 版本与发布口径收口
- **Status**: Complete
- **Files**:
  - `package.json`
  - `package-lock.json`
  - `src/index.ts`
  - `src/bridge/ilink-client.ts`
  - `README.md`
  - `README_CN.md`
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/sessions/SESSION-2026-03-29.md`
  - `GSD/milestones/M003-v1.4-mail-channel/*`
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 120 tests passed
- **Result**: 版本号、banner、channel version、README 和 GSD 已统一到 `v1.4.0 / release ready`

### Subtask: GSD 根文档纠偏
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-29.md`
- **Result**: 根级状态已从“只写了 S05”纠正为“文档收口已完成，但 inbox UAT 仍待凭据”

### Task: M003 S02/S03/S04 Mail Sending And WeChat UX
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 邮件通道已完成 SMTP sender、附件发送与微信命令面，当前只剩真实邮箱 UAT
- **Scope**: nodemailer、smtp sender、bridge command UX、GSD 文档

### Subtask: SMTP sender 实施
- **Status**: Complete
- **Files**:
  - `src/mail/smtp-sender.ts`
  - `src/mail/smtp-sender.test.ts`
  - `src/mail/index.ts`
  - `package.json`
- **Changes**:
  - 安装 `nodemailer`
  - 新增 SMTP sender
  - 新增 transport options builder 与 sender tests
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/mail/contract.test.ts src/mail/config.test.ts src/mail/smtp-sender.test.ts --runInBand --ci` → 14 tests passed

### Subtask: 邮件命令面实施
- **Status**: Complete
- **Files**:
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
  - `src/commands/handler.ts`
  - `src/commands/handler.test.ts`
- **Changes**:
  - 新增 `/mail`
  - 新增 `/mailhtml`
  - 新增 `/mailfile`
  - 接入收件人校验、附件 staging 与错误反馈
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/bridge/core.test.ts src/commands/handler.test.ts --runInBand --ci` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 118 tests passed

### Subtask: M003 文档收口
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-29.md`
  - `GSD/milestones/M003-v1.4-mail-channel/*`
- **Result**: M003 当前状态、切片顺序和下一步已同步到 GSD

## 2026-03-28

### Task: M003 S01 Mail Contract & Provider Decision
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已完成邮件通道的 contract/config 底座，当前里程碑切换到 `M003-v1.4-mail-channel`
- **Scope**: milestone 文档、mail contract、SMTP config normalization、测试、GSD 收口

### Subtask: M003 规划落盘
- **Status**: Complete
- **Files**:
  - `GSD/milestones/M003-v1.4-mail-channel/ROADMAP.md`
  - `GSD/milestones/M003-v1.4-mail-channel/CONTEXT.md`
  - `GSD/milestones/M003-v1.4-mail-channel/RESEARCH.md`
  - `GSD/milestones/M003-v1.4-mail-channel/S01-PLAN.md`
  - `GSD/milestones/M003-v1.4-mail-channel/S01-UAT.md`
  - `GSD/milestones/M003-v1.4-mail-channel/README.md`
- **Result**: `M003` 已从 backlog candidate 升级为 active milestone

### Subtask: 邮件契约与配置底座
- **Status**: Complete
- **Files**:
  - `src/mail/contract.ts`
  - `src/mail/config.ts`
  - `src/mail/index.ts`
  - `src/mail/contract.test.ts`
  - `src/mail/config.test.ts`
- **Changes**:
  - 新增邮件地址、收件人、正文、附件与草稿契约
  - 新增 SMTP config normalization、summary 与 readiness helper
  - 明确 `v1.4` 首版 provider 为 `SMTP`
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/mail/contract.test.ts src/mail/config.test.ts --runInBand --ci` → 10 tests passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 110 tests passed

### Task: M002 S04 UX, Safety & Failure Recovery
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: rich delivery 命令面已补齐图片/文件双入口，且已具备默认安全限制与结构化失败反馈
- **Scope**: command UX、媒体发送结果契约、本地安全限制、自动化验证、GSD 回写

### Subtask: 命令面收口
- **Status**: Complete
- **Files**:
  - `src/commands/handler.ts`
  - `src/commands/handler.test.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 新增 `/sendimage <path>`
  - 为命令解析增加引号参数支持，允许带空格路径
  - 将 `/sendfile` 明确为“按附件发送”
  - 在 bridge 侧统一图片/文件发送命令处理与用户反馈
- **Verification**:
  - `npx jest src/commands/handler.test.ts src/bridge/core.test.ts --runInBand --ci` → passed

### Subtask: 安全限制与失败分类
- **Status**: Complete
- **Files**:
  - `src/media/staging.ts`
  - `src/media/staging.test.ts`
  - `src/bridge/ilink-client.ts`
  - `src/bridge/ilink-client.media.test.ts`
- **Changes**:
  - 为本地媒体发送增加默认大小限制（图片 10 MB / 文件 25 MB）
  - 默认阻止 `.ssh`、`.git`、`.env` 等敏感路径
  - 限制 `/sendimage` 仅接受受支持图片格式
  - 将 `sendLocalMedia()` 从布尔返回升级为结构化结果，区分 staging / upload / send 失败
  - 允许将图片按普通文件附件发送，避免命令语义混乱
- **Verification**:
  - `npx jest src/media/staging.test.ts src/bridge/ilink-client.media.test.ts --runInBand --ci` → passed

### Subtask: M002 当前总验收
- **Status**: Complete
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 91 tests passed
- **Result**: M002 已完成 S04，当前只剩 S05 文档/UAT/发布门与真实设备确认

### Task: M002 S05 Docs, UAT & Release Gate
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: rich delivery 的版本口径、README、UAT 和 release gate 已收口到 `v1.3.0`
- **Scope**: version sync、README、release checklist、GSD 文档

### Subtask: 版本与 README 收口
- **Status**: Complete
- **Files**:
  - `package.json`
  - `package-lock.json`
  - `src/index.ts`
  - `src/bridge/ilink-client.ts`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 将版本号、startup banner、channel version 统一到 `v1.3.0`
  - 将 README / README_CN 同步到 rich delivery 当前命令面、限制和测试基线
  - 将 README 中“文件下发未实现”的旧口径移除
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed

### Subtask: 发布门文档
- **Status**: Complete
- **Files**:
  - `GSD/milestones/M002-v1.3-rich-delivery/S05-PLAN.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/S05-UAT.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/RELEASE-CHECKLIST.md`
- **Result**: M002 已具备显式 UAT 和 release gate 文档，且将真实设备 UAT 保留为 release blocker

### Subtask: 仓库地址占位符清理
- **Status**: Complete
- **Files**:
  - `package.json`
  - `README.md`
  - `GSD/projects/wechat-cli-bridge.md`
  - `GSD/STATE.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/S05-UAT.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/RELEASE-CHECKLIST.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/RELEASE-CHECKLIST.md`
- **Result**: 已将仓库地址统一替换为 `https://github.com/moyetian/wechat-cli-bridge`

### Task: M002 真实设备 UAT 收口
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: rich delivery 已在真实微信设备上完成图片/文件 happy path 与 failure path 验证，M002 达到发布就绪状态
- **Scope**: 真实 bridge 启动、协议修正、设备验证、GSD 收口

### Subtask: 真实设备 happy path 验证
- **Status**: Complete
- **Environment**:
  - 复用 `openclaw-weixin` 登录凭证
  - 使用临时 bridge home `/tmp/wcb-uat-home`
  - 使用设备 UAT 素材 `/tmp/wcb-uat-assets/uat-image.png` 与 `/tmp/wcb-uat-assets/uat-file.txt`
- **Observed Result**:
  - `/sendimage` 图片可正常打开
  - `/sendfile` 文件可正常下载打开

### Subtask: 协议层最终修正
- **Status**: Complete
- **Files**:
  - `src/bridge/ilink-client.ts`
  - `src/bridge/ilink-client.media.test.ts`
- **Changes**:
  - 为 CDN 上传增加重试与更详细错误展开
  - 将 `aes_key` 编码改为与官方插件一致的 hex-string-base64 格式
  - 增加 CDN 重试与 `aes_key` 编码断言测试
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/bridge/ilink-client.media.test.ts --runInBand --ci` → 5 tests passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 92 tests passed

### Subtask: 真实设备 failure path 验证
- **Status**: Complete
- **Observed Result**:
  - `/sendfile /tmp/wcb-uat-assets/missing.txt` → 路径不存在
  - `/sendimage /tmp/wcb-uat-assets/uat-file.txt` → 图片类型不支持
  - `/sendfile /tmp/wcb-uat-assets/.env` → 敏感路径被拒绝
  - `/sendfile /tmp/wcb-uat-assets/too-large.bin` → 超过大小限制
- **Result**: failure path 文案已在真实微信会话中验证通过

### Task: 发布后易用性补强 - 自然语言直发文件
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: bridge 现在可以直接理解“把桌面上的 report.pdf 发给我”这类请求，不必强制用户使用 `/sendfile`
- **Scope**: 自然语言意图识别、桌面文件解析、模糊请求澄清、测试

### Subtask: 自然语言媒体意图解析
- **Status**: Complete
- **Files**:
  - `src/media/natural-send.ts`
  - `src/media/natural-send.test.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
  - `src/commands/handler.ts`
- **Changes**:
  - 新增自然语言“直接发文件/图片”意图识别
  - 支持显式路径和桌面文件名匹配
  - 对模糊请求返回澄清提示，不盲猜文件
  - 在 bridge 层直接执行发送，不走 Agent
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 100 tests passed

### Subtask: 自然语言桌面发送真实验证
- **Status**: Complete
- **Observed Result**:
  - `把桌面上的中国高铁运营路线图发给我` → 正确命中桌面图片匹配，但因 19 MB 超过 10 MB 图片限制而被拒绝
  - `把桌面上的 Weixin.exe.lnk 发给我` → 成功发送并在微信端正常收到
- **Result**: 自然语言桌面文件匹配与直发链路已在真实微信会话中验证通过

### Subtask: 媒体大小限制配置化
- **Status**: Complete
- **Files**:
  - `src/types/index.ts`
  - `src/index.ts`
  - `src/setup.ts`
  - `src/bridge/core.ts`
  - `src/bridge/ilink-client.ts`
  - `src/commands/handler.ts`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 将图片/文件大小限制改为 `config.json` 可调
  - 新增 `media.maxImageSizeMB` / `media.maxFileSizeMB`
  - `/help` 现在会显示当前配置下的媒体限制
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 100 tests passed

### Subtask: GSD 文档回写
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-28.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/ROADMAP.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/S04-PLAN.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/S04-UAT.md`
- **Result**: 今天的 S04 实施、验证和下一步已按 `gsd-2` 口径回写

## 2026-03-27

### Task: M002 Rich Delivery 里程碑规划
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已将下一主里程碑切换为 `M002-v1.3-rich-delivery`
- **Scope**: 微信文件下发规划、邮件里程碑切分、GSD 收口

### Subtask: rich delivery 缺口审计
- **Status**: Complete
- **Files**: `src/bridge/ilink-client.ts`, `src/types/index.ts`
- **Findings**:
  - 枚举层虽有 `IMAGE` / `FILE`
  - inbound/outbound 实现仍只支持 `TEXT`
  - 当前没有附件 staging、上传和发送链路
- **Key Insight**: 这不是 bug，而是未实现能力

### Subtask: 里程碑切换
- **Status**: Complete
- **Files**:
  - `GSD/ROADMAP.md`
  - `GSD/STATE.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/*`
  - `GSD/milestones/M003-v1.4-mail-channel/README.md`
- **Changes**:
  - 将 M001 标记为实现完成
  - 新增 M002 roadmap/context/research/S01 文档
  - 将邮件能力切分为独立的 M003 候选里程碑
- **Result**: 后续执行顺序清晰，不会把微信文件下发与邮件通道混做一团

### Task: M002 S01/S02 基础能力实现
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: media contract 与本地附件 staging 管线已落地
- **Scope**: contract、attachmentsDir、staging、测试

### Subtask: Media Contract
- **Status**: Complete
- **Files**:
  - `src/media/contract.ts`
  - `src/media/contract.test.ts`
  - `src/media/index.ts`
- **Changes**:
  - 定义 `MediaKind`、`MediaSendIntent`、`MediaLifecycleStatus`
  - 定义 `MediaAttachmentDraft`
  - 增加图片/文件类型推断、默认发送意图和摘要函数
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/media/contract.test.ts --runInBand --ci` → 7 tests passed

### Subtask: Attachment Staging Pipeline
- **Status**: Complete
- **Files**:
  - `src/media/staging.ts`
  - `src/media/staging.test.ts`
  - `src/utils/paths.ts`
  - `src/utils/storage.ts`
  - `src/utils/paths.test.ts`
  - `src/utils/storage.test.ts`
- **Changes**:
  - 新增 `attachmentsDir`
  - 实现本地文件存在性检查、普通文件校验、mime 推断、大小限制与 staging copy
  - 以 SHA-256 文件名进行 staging
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/media/staging.test.ts src/utils/paths.test.ts src/utils/storage.test.ts --runInBand --ci` → 24 tests passed

### Subtask: M002 阶段性总验收
- **Status**: Complete
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 80 tests passed
- **Key Insight**: 当前的真实阻塞已经从“本地文件如何准备”转移到“iLink rich media 如何真正发出去”

### Task: M002 S03 WeChat 文件发送链路实现
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已基于官方插件实现落地首版本地文件/图片发送链路
- **Scope**: ClawBot 安装、协议移植、bridge 命令入口、自动化测试

### Subtask: 官方能力探测
- **Status**: Complete
- **Files**:
  - `/home/moyetian/.openclaw/extensions/openclaw-weixin/README.md`
  - `/home/moyetian/.openclaw/extensions/openclaw-weixin/src/messaging/send-media.ts`
  - `/home/moyetian/.openclaw/extensions/openclaw-weixin/src/messaging/send.ts`
  - `/home/moyetian/.openclaw/extensions/openclaw-weixin/src/cdn/upload.ts`
- **Findings**:
  - 官方链路为 `getuploadurl -> AES-128-ECB -> CDN upload -> sendmessage`
  - `IMAGE` 和 `FILE` item 都有明确结构
  - ClawBot 插件支持本地路径和远程 URL 媒体发送
- **Result**: 先前关于 rich media payload 的核心未知点已基本消除

### Subtask: ClawBot 环境接入
- **Status**: Complete
- **Commands**:
  - `npm install -g openclaw`
  - `npx -y @tencent-weixin/openclaw-weixin-cli@latest install`
  - `openclaw channels login --channel openclaw-weixin`
- **Result**: 微信扫码连接成功，`openclaw-weixin` 插件已就绪

### Subtask: 协议层移植
- **Status**: Complete
- **Files**:
  - `src/bridge/ilink-client.ts`
  - `src/bridge/ilink-client.media.test.ts`
- **Changes**:
  - 新增 `getuploadurl` 请求
  - 新增 CDN AES-128-ECB 上传
  - 新增 `sendLocalMedia()` 和 `IMAGE` / `FILE` item 发送
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/bridge/ilink-client.media.test.ts --runInBand --ci` → 2 tests passed

### Subtask: Bridge 命令入口
- **Status**: Complete
- **Files**:
  - `src/commands/handler.ts`
  - `src/commands/handler.test.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 新增 `/sendfile <path>`
  - 支持从当前 `workingDir` 解析相对路径
  - 成功发送后写入决策历史
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/commands/handler.test.ts src/bridge/core.test.ts src/bridge/ilink-client.media.test.ts --runInBand --ci` → 30 tests passed

### Subtask: M002 当前总验收
- **Status**: Complete
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 84 tests passed
- **Result**: M002 已进入“真实设备 UAT + UX 收口”阶段

### Subtask: 真实设备 sendfile 首轮验证
- **Status**: In Progress
- **Environment**:
  - 已安装 `openclaw`
  - 已安装并登录 `openclaw-weixin`
  - 已复用微信凭证启动本项目 bridge
- **Observed Result**:
  - 微信端成功收到 `/sendfile /mnt/f/wechat-cli-bridge/README.md` 触发的文件消息
  - 但手机端当前无法下载查看文件
- **Follow-up**:
  - 已将 `ILinkClient` 的 `base_info`、`X-WECHAT-UIN`、`from_user_id` 对齐到官方插件实现
  - 已完成第二轮重发，等待下次人工确认下载效果

### Task: M001 升级里程碑规划
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 基于 `gsd-2` 模式重新组织下一里程碑，锁定 5 个 slices
- **Scope**: 规划、验证、文档重构

### Subtask: 现状审计
- **Status**: Complete
- **Files**: `core.ts`, `cli-adapter.ts`, `types/index.ts`, `context/manager.ts`, `logger.ts`, `storage.ts`
- **Findings**:
  - 权限模式仅停留在 session 状态层，未接入执行层
  - CLI 默认参数仍带危险 bypass 标志
  - `logger/storage` 模块存在导入时写 home 目录的副作用
  - README/GSD 之间出现状态漂移
- **Key Insight**: 下一阶段应先解决“可验证的底座”和“真实权限协议”，再扩展功能面

### Subtask: 重新定义里程碑
- **Status**: Complete
- **Files**: `GSD/ROADMAP.md`, `GSD/STATE.md`
- **Changes**:
  - 新增当前里程碑 `M001 / v1.2 Permission-Control Hardening`
  - 引入 5 个 slices 顺序：S01 → S05
  - 将验证门前置到每个 slice，而不是只在版本末尾补检查
- **Result**: 规划从“功能清单”升级为“带依赖和验收口径的执行计划”

### Subtask: 里程碑产物落盘
- **Status**: Complete
- **Files**:
  - `GSD/milestones/M001-v1.2-permission-control-hardening/ROADMAP.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/CONTEXT.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/RESEARCH.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/S01-PLAN.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/S01-UAT.md`
- **Result**: 形成 milestone 级路线图、上下文、研究记录和首个 slice 的执行计划

### Subtask: S01 Runtime Base & Testability 实施
- **Status**: Complete
- **Files**:
  - `src/utils/paths.ts`
  - `src/utils/logger.ts`
  - `src/utils/storage.ts`
  - `src/index.ts`
  - `src/setup.ts`
  - `bin/daemon.js`
  - `src/utils/bootstrap.test.ts`
  - `src/utils/paths.test.ts`
  - `src/utils/storage.test.ts`
- **Changes**:
  - 新增统一 bridge path 解析层，支持 `WECHAT_CLI_BRIDGE_HOME`
  - 将 logger 改为显式初始化，并在未初始化时回退到 console logger
  - 将 storage 改为 lazy singleton，移除模块导入时目录创建副作用
  - 启动入口、setup、daemon 统一采用新的路径约定
  - 为导入无副作用和路径推导增加测试
- **Result**: `build/lint/test` 自动化验证通过，S01 的工程底座目标达成

### Subtask: S02 Permission Contract 实施
- **Status**: Complete
- **Files**:
  - `src/permissions/contract.ts`
  - `src/types/index.ts`
  - `src/commands/handler.ts`
  - `src/context/manager.ts`
  - `src/bridge/core.ts`
  - `src/context/manager.test.ts`
  - `src/commands/handler.test.ts`
- **Changes**:
  - 新增统一 permission contract 常量与描述
  - 将审批请求纳入 session state 持久化
  - 补齐 `/pending`、`/approve`、`/deny` 命令
  - 修复 `ContextManager.load()` 默认值覆盖已保存 session 的问题
  - 为审批请求 round-trip、歧义解析、默认值一致性补测试
- **Key Insight**: S02 解决的是“权限语义不一致”和“命令面缺失”，不是执行前门控本身
- **Result**: 权限契约成为单一事实源，S03 可以在此基础上实现状态机

### Subtask: S03 Approval State Machine 实施
- **Status**: Complete
- **Files**:
  - `src/permissions/policy.ts`
  - `src/permissions/policy.test.ts`
  - `src/types/index.ts`
  - `src/context/manager.ts`
  - `src/context/manager.test.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
  - `src/bridge/ilink-client.ts`
- **Changes**:
  - 新增 bridge 级任务分类策略与审批触发规则
  - 将待执行任务持久化到 session state，并与 approval request 关联
  - 在加载 session 时自动处理过期审批
  - 在 bridge 中实现“申请审批 -> 等待 -> 批准后恢复执行”
  - 新增 `y/yes/n/no` 快捷审批语义
- **Key Insight**: S03 解决的是“审批流是否真实存在”，不是“各 CLI 如何映射权限 flags”
- **Result**: bridge 层审批闭环已形成，S04 可以专注于 agent 参数和模式细化

### Subtask: S04 Agent Enforcement 实施
- **Status**: Complete
- **Files**:
  - `src/agents/cli-permissions.ts`
  - `src/agents/cli-permissions.test.ts`
  - `src/agents/cli-adapter.ts`
  - `src/agents/cli-adapter.test.ts`
  - `src/agents/index.ts`
  - `src/types/index.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 新增 CLI permission profile 与 mode-to-args 构造器
  - 将默认 agent 配置从静态危险参数改为受 permission mode 驱动
  - 在 `CLIAdapter` 中接入 profile 解析、旧参数去重和 bridge-approved 自动升级
  - 增补已批准任务在 mode 变更后仍可恢复执行的保护逻辑
  - 为参数构造和 adapter spawn 参数新增单元测试
- **Key Insight**: S04 解决的是“bridge 审批语义如何真正下沉到 CLI 执行参数”，而不是再造一层审批
- **Result**: `interactive / acceptEdits / auto / plan` 在 bridge 与 CLI 执行层已基本对齐

### Subtask: S05 Release Gate 实施
- **Status**: Complete
- **Files**:
  - `.github/workflows/ci.yml`
  - `README.md`
  - `README_CN.md`
  - `package.json`
  - `src/index.ts`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/RELEASE-CHECKLIST.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/S05-PLAN.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/S05-UAT.md`
- **Changes**:
  - CI 扩展为 Ubuntu / Windows x Node 18 / 20，并纳入 `build/lint/test`
  - README 与 README_CN 同步到当前权限协议、命令面、已知限制和验证方式
  - 版本号和启动 banner 升级到 `v1.2.0`
  - 增加 milestone release checklist
- **Result**: M001 进入“实现完成，等待手工 UAT/发布”的状态

### Subtask: 现实验证复核
- **Status**: Complete
- **Verification**:
  - `node -e "yaml.parse(...)"` → workflow ok
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 68 tests passed
- **Result**: S01/S02/S03/S04/S05 当前自动化验证全部通过

### Subtask: 用户反馈问题入账
- **Status**: Complete
- **Issues**:
  - 电脑文件无法通过 ClawBot 下发到手机微信端
  - 无法通过邮件发送信息或文件
- **Decision**: 这两个问题不属于 S01 范围，先记录为后续能力缺口，待 S02 以后评估是否纳入新里程碑

---

## 2026-03-25

### Task: 稳定性和代码质量优化
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: v1.1 稳定性优化完成，项目更健壮
- **Scope**: 连接重连、进程管理、测试框架、安全防护

### Subtask: 指数退避重连机制
- **Status**: Complete
- **Files**: `ilink-client.ts`
- **Changes**:
  - 添加 `INITIAL_RETRY_DELAY` (1s) 和 `MAX_RETRY_DELAY` (60s) 常量
  - 实现 `retryDelay` 和 `consecutiveErrors` 追踪
  - 成功时重置延迟，失败时指数增长
- **Key Insight**: 避免服务器压力过大，智能退避

### Subtask: 心跳检测机制
- **Status**: Complete
- **Files**: `ilink-client.ts`
- **Changes**:
  - 30s 心跳间隔 (`HEARTBEAT_INTERVAL`)
  - `startHeartbeat()` / `stopHeartbeat()` 生命周期管理
  - `isHealthy()` 健康状态判断
  - `getStats()` 连接统计信息
- **Key Insight**: 主动监控连接健康，及时发现问题

### Subtask: 任务超时状态清理
- **Status**: Complete
- **Files**: `cli-adapter.ts`
- **Changes**:
  - 添加 `isTimedOut` 标志防止重复处理
  - 超时后先 SIGTERM，5s 后 SIGKILL
  - 确保 `activeProcess = null` 状态清理
- **Key Insight**: 双阶段终止避免僵尸进程

### Subtask: ESLint 配置
- **Status**: Complete
- **Files**: `.eslintrc.json`, `package.json`
- **Changes**:
  - TypeScript ESLint 规则
  - 测试文件排除配置
  - 新增 `npm run lint` 和 `npm run lint:fix` 脚本
- **Result**: 代码风格一致性保障

### Subtask: 单元测试框架
- **Status**: Complete
- **Files**: `jest.config.js`, `handler.test.ts`, `storage.test.ts`
- **Changes**:
  - Jest + ts-jest 配置
  - 33 个测试用例
  - 覆盖命令解析和存储模块
- **Result**: `npm test` 全部通过

### Subtask: 命令注入防护
- **Status**: Complete
- **Files**: `cli-adapter.ts`
- **Changes**:
  - `DANGEROUS_PATTERNS` 危险模式检测
  - `sanitizeInput()` 输入消毒函数
  - Windows/Unix 双平台转义
  - 警告日志输出
- **Key Insight**: 防御性编程，主动检测风险

---

## 2026-03-24

### Task: 修复消息输出丢失问题
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: CLI 输出完整发送，不再只发送摘要
- **Root Cause**: `handleTask` 中只使用了 `result.summary`，忽略了 `result.output`
- **Solution**: 将 `result.output` 包含在响应中

### Task: 长消息分片发送
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 长消息自动分片发送，每片带序号标记
- **Files**: `ilink-client.ts` 新增 `splitMessage` 和 `sendLongMessage`

### Task: iFlow CLI 参数传递修复
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 单行和多行任务都能正确执行
- **Root Cause**: 多行任务作为位置参数传递时 Windows shell 转义失败
- **Solution**: 单行任务用位置参数 `iflow "task"`，多行任务用 `-p` + stdin

### Task: 上下文格式修复
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 新会话不传空上下文，避免误导
- **Root Cause**: `[上下文摘要]` 标记被 iFlow 当作任务内容
- **Solution**: 改用清晰分隔符，新会话返回空字符串

### Task: CLI 权限参数同步
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 所有 CLI Agent 自动跳过权限确认
- **Solution**: 各 CLI 配置对应参数 (iFlow/Gemini: -y, Claude: --dangerously-skip-permissions, Codex: --dangerously-bypass-all)

### Task: 超时时间增加
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 复杂任务有更充足的执行时间
- **Solution**: 从 5 分钟增加到 10 分钟

### Task: GitHub 发布准备
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 项目打包并完善文档
- **Files**: 完善 README.md 和 README_CN.md

---

## 2026-03-23

### Task: 项目架构设计
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 确定了三层架构：Bridge Core + Context Manager + Agent Adapters

### Task: iLink API 客户端实现
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 实现了正确的 API 格式、认证方式、消息收发
- **Key Insight**: iLink API 是独立协议，不依赖 OpenClaw

### Task: CLI Agent 适配器
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 支持 iFlow、Claude、Codex、Gemini 四个 CLI
- **Key Insight**: Windows 需要 shell: true 才能找到 npm 全局命令

### Task: 上下文管理器
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 实现了 GSD 风格的状态追踪
- **Files**: STATE.md, HISTORY.md, CONTEXT.md

### Task: 二维码登录流程
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 扫码获取 token、accountId、userId

### Task: Windows 兼容性修复
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 解决了命令执行、stdin 传递问题

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-25 | 指数退避重连 1s→60s | 避免暴力重连，保护服务器 |
| 2026-03-25 | 心跳间隔 30s | 平衡监控频率和资源消耗 |
| 2026-03-25 | SIGTERM + SIGKILL 双阶段终止 | 给进程清理机会，强制兜底 |
| 2026-03-25 | 危险模式检测而非完全禁止 | 灵活性与安全性平衡 |
| 2026-03-25 | GSD 状态追踪更新 | 保持项目上下文连续性 |
| 2026-03-24 | iFlow 使用 `-y` 参数 | --yolo 模式自动接受操作 |
| 2026-03-24 | 多行任务用 `-p` + stdin | 避免 Windows shell 转义问题 |
| 2026-03-24 | 新会话不传空上下文 | 避免误导 Agent |
| 2026-03-24 | 超时设为 10 分钟 | 支持复杂任务执行 |
| 2026-03-23 | 使用 TypeScript | 类型安全 |
| 2026-03-23 | 移除 sessionResume | 改用上下文注入 |
| 2026-03-23 | Windows 使用 shell: true | npm 命令查找 |

---

**Last Updated**: 2026-03-27
