# S05 Plan: Release Gate

**Milestone**: M001
**Depends On**: S04
**Status**: Implemented

## Slice Goal

把当前实现、文档、CI 和发布口径收拢成一个可交接的 v1.2.0 版本。

## Must-Haves

### Truths
- README 与当前能力一致
- GSD 根文档与 milestone 文档一致
- CI workflow 已覆盖 `build/lint/test`
- 存在显式 release checklist

### Artifacts
- `.github/workflows/ci.yml`
- 更新后的 `README.md` / `README_CN.md`
- `RELEASE-CHECKLIST.md`
- 更新后的 GSD 状态与里程碑文档

### Key Links
- `package version -> startup banner -> README`
- `local verification -> CI workflow -> release checklist`

## Result

- CI 已升级为 Ubuntu / Windows x Node 18 / 20
- 文档已同步到当前权限协议和命令面
- release checklist 已创建
- M001 的实现面已完成，剩余为真实环境手工 UAT

## Exit Criteria

- S05 must-haves 全部为真
- M001 进入“实现完成，等待手工 UAT/发布”的状态
