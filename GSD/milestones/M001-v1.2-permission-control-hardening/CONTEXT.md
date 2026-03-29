# M001 Context: v1.2 Permission-Control Hardening

**Last Updated**: 2026-03-27

## Mission

本里程碑的任务不是继续横向扩功能，而是先把 bridge 的安全边界、执行协议和验证能力收紧。

## Current Repo Truths

1. 命令层已经支持 `/permission`，但执行层尚未消费该状态。
2. `types/index.ts` 已预留 `needsPermission` 与 `permissionRequest`，但未形成闭环。
3. `ILinkClient` 已提供 `requestPermission()`，S03 已将其接入 bridge 审批流。
4. `agents/index.ts` 对 CLI 默认注入 `-y` 或 `--dangerously-*`，导致权限模式天然失真。
5. `logger.ts` 和 `storage.ts` 在导入阶段就创建 home 目录，导致测试和受限环境脆弱。
6. README、GSD 根文档、当前代码实现之间存在状态漂移。
7. `S04` 已补齐 CLI mode-to-flag 映射，bridge 与 agent 执行策略已基本对齐。

## Why The Order Matters

如果不先做 S01：
- CI 仍会被运行时副作用拖垮
- 后续权限逻辑缺乏稳定测试反馈

如果不先做 S05：
- README 和 GSD 根文档会继续落后于当前能力
- 本地验证结果无法沉淀为 CI 保证

如果跳过 S05：
- 文档和版本状态会继续漂移
- 下一轮开发会再次失去单一事实源

## Frozen Decisions

1. `plan` 模式只返回计划，不启动 agent 进程。
2. `auto` 是唯一允许危险 bypass 参数的模式。
3. 本里程碑的权限控制粒度以 bridge 任务级为主，不追求 CLI 内部工具事件级拦截。
4. 所有审批状态必须可持久化，不能只存在内存。
5. 所有 slice 都要有独立验证门，不能留到 milestone 末尾统一补测。
6. 在 S03 之前，不把“命令可用”误写成“审批流已完成”。

## Open Risks

1. 不同 CLI 的参数语义不完全一致，统一 permission mode 需要保留 adapter 差异。
2. Windows shell 行为与 Unix spawn 行为不同，参数构造需要单独测。
3. `acceptEdits` 的边界需要定义清楚，否则会退化成另一个 `auto`。
4. 现有 session 数据可能缺少新字段，需要兼容旧数据。

## Validation Strategy

### Automated
- `npm run build`
- `npm run lint`
- `npm test`
- adapter 参数构造测试
- approval state machine 测试

### Manual
- 微信里发送 `/permission interactive`
- 发送需要修改文件的任务，确认先进入待审批
- 发送 `/approve` 后任务继续
- 发送 `/deny` 后任务中止
- 发送 `/permission plan` 后任务只返回计划

## Deferred Work

- 图片/文件消息
- 电脑文件下发到手机微信端
- 多账户切换
- 任务进度推送
- 多 Agent 链式调用
- 平台化能力
- 邮件发送信息/附件能力
