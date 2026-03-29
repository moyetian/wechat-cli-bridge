# M002 Research Notes

**Date**: 2026-03-27

## Local Code Audit

### Existing iLink Types
- `src/bridge/ilink-client.ts`
- 发现：
  - `MessageItemType.TEXT = 1`
  - `MessageItemType.IMAGE = 2`
  - `MessageItemType.FILE = 4`
- 结论：
  - 类型枚举已预留 rich media
  - 但当前 `MessageItem` interface 只显式支持 `text_item`

### Existing Inbound Parsing
- `ILinkClient.parseMessage()`
- 发现：
  - 当前只遍历 `item_list`
  - 只读取 `TEXT` item
- 结论：
  - 即使微信端发来图片/文件，bridge 当前也不会解析到统一消息结构

### Existing Outbound Sending
- `ILinkClient.send()`
- 发现：
  - 当前 outbound `msg.item_list` 固定为一个文本 item
  - `sendMarkdown()` 本质也是发文本
- 结论：
  - 当前不存在图片或文件下发链路

### Existing Product Gap
- 用户反馈：
  - 电脑文件无法通过 ClawBot 发到手机微信端
  - 无法通过邮件发送信息或文件
- 结论：
  - 这不是 bug，而是功能缺失

## External Research Summary

我尝试检索公开的 iLink / ClawBot rich media 资料，但没有在当前轮拿到可直接引用的权威 payload 文档，因此无法在规划阶段假定其精确字段结构已经明确。

检索方向包括：
- GitHub 上的 `iLink bot sendmessage image/file item_list`
- `wechat-claude-code` 相关实现
- `ilinkai.weixin.qq.com` 公开页面

结论仍然是：
- 没有拿到足够明确的 `IMAGE/FILE` outbound payload 官方示例
- S03 必须把 capability probe 或真实设备试验当成前置条件

这意味着：

1. M002 的 S01 必须先做 capability probe。
2. 如果 iLink rich media 需要先上传再引用，bridge 需要单独的 upload abstraction。
3. 如果官方能力不足，M002 范围可能需要收窄到“图片优先、普通文件次之”。

## Planning Implications

1. M002 先做 contract 和 capability probe，不直接跳到 sender 实现。
2. M003 Mail Channel 独立出来，避免混入同一验证面。
3. 发布条件必须包含真实手机侧手工验证。
