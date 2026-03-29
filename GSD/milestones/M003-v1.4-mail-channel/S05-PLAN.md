# S05 Plan: UAT & Release Gate

**Milestone**: M003
**Depends On**: S04
**Status**: Implemented

## Slice Goal

把 mail channel 的文档、配置样例、真实收件箱验证和发布门收拢成一个可交接的 `v1.4.0` 候选版本。

## Must-Haves

### Truths
- README / README_CN 与当前邮件命令面和配置方式一致
- 模板配置包含 `media` 与 `mail` 示例，不再和运行时默认值漂移
- GSD 根文档与 milestone 文档一致
- release checklist 明确真实 SMTP 凭据和收件箱验证仍是发布阻塞项

### Artifacts
- 更新后的 `README.md` / `README_CN.md`
- 更新后的 `templates/config.example.json`
- `S05-UAT.md`
- `RELEASE-CHECKLIST.md`

### Key Links
- `mail config example -> local config.json -> SMTP sender`
- `automated verification -> inbox UAT -> release checklist`

## Implementation Tasks

### T01 - Docs And Template Sync
- 将 README / README_CN 同步到 `/mail`、`/mailhtml`、`/mailfile`
- 补齐 SMTP 配置示例与启用说明
- 将 `templates/config.example.json` 同步到当前 `media` / `mail` 配置结构

### T02 - Inbox UAT Preparation
- 审核本地已有 bridge home，确认是否存在可直接复用的 SMTP 凭据
- 明确真实收件箱验证的最小步骤：text / html / attachment / failure path
- 保持凭据只落在本地配置，不写入聊天流或 GSD

### T03 - Release Gate
- 新增 M003 的 `RELEASE-CHECKLIST.md`
- 明确真实 SMTP inbox UAT 通过前，不提升正式版本口径到 `v1.4.0`
- 将 `package.json` / startup banner / channel version 的版本切换保留到最终 release gate

### T04 - GSD Sync
- 更新根级 `STATE.md`
- 更新根级 `ROADMAP.md`
- 更新 `HISTORY.md`
- 更新 `SESSION-2026-03-29.md`

## Current Progress

- [x] 文档与模板配置同步
- [x] S05 文档与 release checklist 落盘
- [x] 本地 bridge home 脱敏审计
- [x] 准备真实 SMTP 凭据
- [x] 执行真实收件箱 UAT
- [x] 切换正式版本口径到 `v1.4.0`

## Exit Criteria

- S05 must-haves 全部为真
- 真实 SMTP text / html / attachment UAT 通过
- 可以将 M003 标记为 release ready，或正式发布 `v1.4.0`
