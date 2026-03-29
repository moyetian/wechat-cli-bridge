# S05 Plan: Docs, UAT & Release Gate

**Milestone**: M002
**Depends On**: S04
**Status**: Implemented

## Slice Goal

把 rich delivery 的实现、版本口径、README、UAT 和发布门收拢成一个可交接的 `v1.3.0` 候选版本。

## Must-Haves

### Truths
- README / README_CN 与当前 rich delivery 能力一致
- GSD 根文档与 milestone 文档一致
- 存在显式的 `M002` release checklist
- 版本号、启动 banner 和 channel version 口径一致

### Artifacts
- 更新后的 `README.md` / `README_CN.md`
- `package.json` / startup banner / channel version
- `S05-UAT.md`
- `RELEASE-CHECKLIST.md`

### Key Links
- `package version -> startup banner -> README`
- `automated verification -> device UAT -> release checklist`

## Implementation Tasks

### T01 - Version And Docs Sync
- 将版本口径统一到 `v1.3.0`
- 更新 README 到当前命令面、限制和验证基线
- 更新 README_CN 到当前阶段状态与能力口径

### T02 - UAT And Release Gate
- 新增 M002 的 `S05-UAT.md`
- 新增 M002 的 `RELEASE-CHECKLIST.md`
- 明确真实设备 UAT 仍是 release blocker

### T03 - GSD Sync
- 更新根级 `STATE.md`
- 更新根级 `ROADMAP.md`
- 更新 `HISTORY.md`
- 更新 session 记录

## Result

- rich delivery 的文档与版本口径已收口
- release gate 文档已具备
- 当前只剩真实设备 UAT 和发布前人工检查

## Exit Criteria

- S05 must-haves 全部为真
- M002 进入“实现完成，等待设备 UAT/发布”的状态
