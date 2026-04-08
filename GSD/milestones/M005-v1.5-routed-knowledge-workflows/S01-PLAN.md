# M005 S01 Plan: Semantic Gateway & Job Model

## Goal

把当前微信前门升级为一个可路由、可追问、可落盘 job 的控制入口，为后续 `PRISM memory`、`writing lane` 和 `research lane` 建底座。

## Must-haves

- route catalog 初版落地
- 启发式 router adapter 落地
- bridge 主流程接入 workflow gateway
- `workflowJobs` 持久化到 session state
- 高风险 research run request 先走 bridge 审批
- 现有 CLI / media / mail 主路径不回归

## Files

- `src/types/index.ts`
- `src/routing/contract.ts`
- `src/routing/router-adapter.ts`
- `src/routing/gateway.ts`
- `src/routing/index.ts`
- `src/context/manager.ts`
- `src/bridge/core.ts`

## Result

- [x] `workflow route / lane / gate / job / artifact` 契约已新增
- [x] 启发式 router 已支持 `article_* / research_* / status_query / general_cli_task`
- [x] bridge 已在自然语言 mail/media 之后、CLI 执行之前接入 workflow gateway
- [x] `workflowJobs` 已持久化并出现在 `/status` / `STATE.md` 摘要中
- [x] `research_run_request` 已进入审批流，但当前仍不直接启动真实研究执行器
