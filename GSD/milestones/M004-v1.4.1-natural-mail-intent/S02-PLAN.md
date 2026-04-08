# M004 S02 Plan: Bridge UX & Docs Sync

## Goal

把自然语言邮件解析结果接入 bridge 主流程，并同步帮助文案与 README。

## Must-haves

- bridge 命中自然语言邮件时直接发信
- 不启动 agent
- help text / README / README_CN 同步到当前能力

## Result

- [x] `src/bridge/core.ts` 已接入自然语言邮件分支
- [x] `src/bridge/core.test.ts` 已补 happy path / clarify / defaultTo 覆盖
- [x] `src/commands/handler.ts` / `README.md` / `README_CN.md` 已同步
