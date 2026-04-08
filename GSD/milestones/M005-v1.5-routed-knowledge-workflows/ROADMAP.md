# M005 Roadmap: v1.5 Routed Knowledge Workflows

**Last Updated**: 2026-04-08
**Status**: Release Ready (public endpoint routed through nginx `/research-executor`)

## Milestone Goal

建立一个由微信驱动的知识工作控制平面，让用户可以通过微信消息调度不同工作流：

- `writing lane`：公众号文章生产
- `research lane`：研究立项、实验编排、论文草稿
- `general cli lane`：保留当前 CLI agent 能力

这个里程碑不等于“把所有能力塞进一个大 agent”，而是：

- 微信负责前门、审批、状态回传
- `semantic-router` 负责意图门控
- `PRISM` 负责记忆与上下文装载
- lane-specific orchestrator 负责具体产出
- governance layer 负责成本、安全、发布边界

## Architecture Intent

### Control Plane

`WeChat -> Semantic Router -> Workflow Gateway -> Memory / Artifact Layer -> Governance / Compute -> Worker Lane`

### Worker Lanes

1. `general cli lane`
   - 继续复用当前 `wechat-cli-bridge`
2. `writing lane`
   - 以 `WeWrite` 为核心，产出公众号文章、标题、摘要、封面、排版 HTML、草稿箱结果
3. `research lane`
   - 以 `AI Scientist-v2` 为核心，产出研究计划、novelty check、实验运行结果、论文草稿

### PRISM Stack

1. `logic layer`
   - `mem0` 长期记忆
   - `prism-mcp` 风格的渐进上下文装载、行为记忆、三层搜索、压缩检索
2. `gateway layer`
   - `semantic-router` 做微信输入门控与 route selection
3. `compute layer`
   - 任务队列、预算门、GPU 资源、sandbox 执行和上下文冷热分层

## Definition Of Done

### Truths

- 微信输入先经过明确路由，不会直接盲目触发重任务
- 文章工作流与研究工作流彼此独立，可分别演进
- 系统的上下文单位以 `artifact` 和 `memory` 为主，而不是无限扩张的聊天记录
- 高成本研究任务必须经过预算 / 安全 / 发布门

### Core Artifacts

- route catalog
- workflow job model
- memory model
- article artifacts
- research artifacts
- approval records
- compute run records
- governance reports

## Slice Dependency Order

`S01 -> S02 -> S03 -> S04 -> S05 -> S06`

## Slices

| Slice | Title | Goal | Depends On | Risk | Status |
|-------|-------|------|------------|------|--------|
| S01 | Semantic Gateway & Job Model | 把微信前门升级为带 route / gate / job 的控制平面 | - | Medium | Implemented |
| S02 | PRISM Memory Core | 建立长期记忆、工作记忆和 artifact 检索策略 | S01 | High | Implemented |
| S03 | Writing Lane / WeWrite Integration | 接入公众号文章生产线 | S02 | Medium | Implemented |
| S04 | Research Proposal Lane | 先支持研究立项、预算、计划与 novelty 粗检 | S02 | High | Implemented |
| S05 | Sandboxed Research Execution | 受控接入 `AI Scientist-v2` 的实验执行与论文初稿 | S04 | Very High | Implemented |
| S06 | Governance, Compute & Release Gate | 完成预算门、审批门、GPU 调度与发布边界 | S05 | High | Implemented |

### S01 - Semantic Gateway & Job Model

**Result (2026-03-30)**
- 已新增 route / lane / gate / job / artifact 契约
- 已新增启发式 router adapter 与 routing gateway
- 已在 bridge 主流程接入 workflow gateway
- 已为 `research_run_request` 接上 bridge 审批流
- 已为 workflow job 增加 session 持久化与 `/status` 展示

### S02 - PRISM Memory Core

**Result (2026-03-30)**
- 已新增 `PRISMMemoryCore`
- 已支持 `quick / standard / deep` 三档 profile selector
- 已支持 `hot / warm / cold` 三层 memory entries
- 已在 `/context` 与 CLI agent 执行路径接入 memory bundle
- 当前仍基于现有 `ContextState` 构建 memory bundle，尚未正式接入 `mem0`

### S03 - Writing Lane / WeWrite Integration

**Result (2026-03-30)**
- 已新增 `WeWriteAdapter`
- 已支持 article workflow artifact 落盘
- 已支持本地 WeWrite skill 路径探测
- 已支持优先选择 `claude / openclaw` 作为 writing lane agent
- 当前机器已安装真实 `WeWrite` 到 `~/.openclaw/skills/wewrite`
- 真实微信 article lane 已通过 `codex` + WeWrite prompt 收口后的实机 UAT

### S04 - Research Proposal Lane

**Result (2026-03-30)**
- 已新增 `ResearchProposalAdapter`
- 已支持 `research_idea / research_plan` 进入 proposal lane
- 已落盘 research brief / proposal / novelty / budget artifacts
- 已明确 proposal lane 不启动真实实验
- `AI Scientist-v2` 真实执行仍保留到 `S05`

### S05 - Sandboxed Research Execution

**Result (2026-03-30)**
- 已新增 `ResearchExecutor`
- 已支持 `remote_http / local_gpu` 双 backend skeleton
- 已支持批准后的 `research_run_request` 真实提交
- 已落盘 run manifest / runtime config / request / queue ticket artifacts
- 真实 `AI Scientist-v2` worker 和 remote executor endpoint 仍待后续环境接入
- 仓库现已补最小 `remote_http` executor 服务，可直接作为云端部署起点

### S06 - Governance, Compute & Release Gate

**Result (2026-03-31)**
- 已新增 governance engine，支持 budget / runtime / safety / release gate
- 已新增 `wechat_realtime / writing_batch / research_sandbox` compute pool
- research workflow 已落盘 governance report / release gate artifacts
- 已支持 `pollRunStatus()` 与 `/status` research run 状态刷新
- 已支持 `/recover [jobId]` 对 failed research run 执行 recovery
- local / remote research executor 已补 `statusDir` 与 `/research-runs/:runId` 状态 contract
- 已新增 `local_gpu` mock worker，支持本地 queue -> status -> recover smoke/UAT
- 已新增 `WeWrite` mock mode，支持本地 article lane smoke/UAT
- 已新增 `npm run uat:m005-local`，支持一键联跑本地 article/research mock UAT
- 已新增 `npm run uat:m005-bridge`，支持走完整 bridge runtime 语义的本地 UAT
- 已新增 `npm run uat:m005-doctor`，支持真实环境缺口盘点
- `codex exec` 在非 git working directory 下现会自动补 `--skip-git-repo-check`
- `codex exec` 已支持向 workflow artifact 目录追加 `--add-dir`
- WeWrite prompt 已收紧为最小读取集，避免无关目录扫描

## Exit Criteria

- [x] 6 个 slices 全部具备明确执行边界
- [x] 微信路由、记忆、artifact、审批、队列之间的接口被定义清楚
- [x] 已具备决定是否正式进入 release/UAT 收口阶段的条件
