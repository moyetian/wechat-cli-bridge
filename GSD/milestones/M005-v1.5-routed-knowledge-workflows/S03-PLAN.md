# M005 S03 Plan: Writing Lane / WeWrite Integration

## Goal

把 `article_create / article_edit` 从“只识别 route”推进到真正的 `writing lane`：

- article workflow job
- article artifact model
- WeWrite 安装路径探测
- writing lane agent 选择
- bridge 到 writing lane 的执行接线

## Must-haves

- `writing` 模块落地
- article artifacts 落盘
- WeWrite skill 缺失时明确提示
- 检测到本地 WeWrite + 可用 writing agent 时触发执行
- 保持现有 routing / memory / CLI / mail / media 路径不回归

## Files

- `src/writing/contract.ts`
- `src/writing/wewrite-adapter.ts`
- `src/writing/index.ts`
- `src/writing/wewrite-adapter.test.ts`
- `src/context/manager.ts`
- `src/bridge/core.ts`
- `src/bridge/core.test.ts`

## Result

- [x] `writing lane` adapter 已新增
- [x] article artifacts 已落盘到 session artifact 目录
- [x] 已支持本地 WeWrite 安装路径探测
- [x] 已支持 `claude / openclaw` writing agent 选择
- [x] 本地缺少 WeWrite 时会明确提示，不会伪装成功
- [x] 检测到 skill + 可用 agent 时会直接触发 writing lane 执行
