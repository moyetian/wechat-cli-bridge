# M002 Context: v1.3 Rich Delivery

**Last Updated**: 2026-03-27

## Mission

这次不是继续打磨权限协议，而是解决一个明确的产品缺口：把本地文件和图片送到手机微信端。

## Current Repo Truths

1. `src/bridge/ilink-client.ts` 定义了 `MessageItemType.IMAGE` 与 `MessageItemType.FILE`，但当前 `MessageItem` 结构只实际支持 `text_item`。
2. `parseMessage()` 只从 `TEXT` item 提取内容。
3. `send()` 只构造文本消息，不支持 rich `item_list`。
4. 仓库中没有附件上传、mime 判断、文件大小限制、附件引用或 staging 抽象。
4.1 这一点在 S02 后已部分解决：当前已有本地 staging、mime 推断和 attachments 目录，但还没有 outbound sender。
5. 用户已经明确反馈“电脑文件无法发到手机微信端”。
6. 邮件发送能力同样缺失，但当前没有任何通道层和配置层实现。

## Planning Decision

M002 只做微信侧 rich delivery，不把邮件混进来。

原因：
- 微信 rich delivery 已经有部分类型预留，增量最小
- 邮件通道需要单独的 provider/config/security 设计
- 两条外部通道一起做会让验证矩阵和故障面翻倍

## Open Unknowns

1. iLink 对 outbound `IMAGE` / `FILE` item 的精确 payload 结构仍未在当前仓库中被验证。
2. 是否需要先上传文件再发送引用，当前没有现成实现。
3. 微信端对文件大小、图片格式、文件名编码的限制尚未在代码中体现。

## Validation Strategy

### Automated
- attachment contract tests
- staging/validator tests
- sender contract tests
- bridge rich-delivery flow tests

### Manual
- 发送一个小图片到手机微信端
- 发送一个普通文本文件到手机微信端
- 发送不存在路径
- 发送超限大小文件
- 发送不支持类型

## Deferred Work

- 邮件发送正文
- 邮件发送附件
- 富媒体入站解析
- 多账户媒体隔离
