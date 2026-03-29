# S04 Plan: UX, Safety & Failure Recovery

**Milestone**: M002
**Depends On**: S03
**Status**: Implemented

## Slice Goal

把 rich delivery 从“协议上能发”推进到“命令上可用、失败时可诊断、默认行为足够安全”。

## Must-Haves

### Truths
- 用户可以明确区分“发图片”和“发文件”
- 带空格的本地路径可以被稳定解析
- 失败信息能区分路径错误、类型错误、超限和协议层失败
- 默认拒绝高风险路径和明显不合理的过大文件

### Artifacts
- `/sendimage <path>` 命令
- 更清晰的 `/sendfile <path>` 语义
- rich delivery 结构化结果与错误码
- safety / failure-path tests

### Key Links
- `user command -> path parsing -> local staging policy -> ilink sender`
- `media sender result -> bridge user feedback -> session decision`

## Implementation Tasks

### T01 - Command UX
- 新增 `/sendimage <path>`
- 调整 `/sendfile <path>` 为“按附件发送”
- 为命令解析增加引号参数支持，兼容带空格路径

### T02 - Structured Failures
- 将 `sendLocalMedia()` 从 `boolean` 升级为结构化结果
- 明确区分 staging、upload、send 三层失败
- 在 bridge 侧将错误码映射为用户可读反馈

### T03 - Local Safety Policy
- 引入默认大小限制
  - 图片 10 MB
  - 文件 25 MB
- 阻止 `.ssh`、`.git`、`.env` 等敏感路径
- 限制 `/sendimage` 仅接受受支持图片格式

### T04 - Automated Verification
- 扩展 command/core/media 测试
- 覆盖 quoted path、image/file mode、protected path、unsupported image 等路径

## Result

- rich delivery 已有图片/文件两条明确入口
- 失败提示已能给出更具体原因
- 默认安全边界已建立
- 自动化验证通过：`build/lint/test`

## Out Of Scope

- README / README_CN 同步
- 真实设备 UAT 收口
- release checklist

## Exit Criteria

- S04 must-haves 全部为真
- S05 可以只关注文档、UAT 和发布门，而不再返工命令/安全底座
