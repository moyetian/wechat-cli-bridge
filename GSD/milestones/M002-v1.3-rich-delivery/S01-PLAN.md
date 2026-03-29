# S01 Plan: Capability Probe & Media Contract

**Milestone**: M002
**Depends On**: none
**Status**: Implemented

## Slice Goal

在真正编码发送链路前，先确认 rich media 的 iLink 能力边界，并定义 bridge 内部的附件契约。

## Must-Haves

### Truths
- 已确认当前代码只支持文本收发
- 已形成统一 attachment metadata 结构
- 已确定 M002 只覆盖微信文件/图片下发，不覆盖邮件

### Artifacts
- media contract 草案
- probe 结论与限制清单
- 后续 S02/S03 的输入输出定义

### Key Links
- `local file path -> attachment metadata -> outbound item_list`

## Task Breakdown

### T01 - Audit Current iLink Client
- 逐项列出现有 `item_list` 支持情况
- 标记 inbound/outbound 各自缺失点

### T02 - Define Attachment Metadata
- 文件路径
- 文件名
- mime/type
- size
- staging 状态
- 目标通道类型（image/file）

### T03 - Define Sender Boundary
- 发送入口是命令、任务、还是显式 helper
- sender 失败时如何回传给用户
- sender 成功后是否进入 HISTORY/STATE

### T04 - Capture Unknowns
- payload 字段未知项
- 上传方式未知项
- 文件大小和格式限制未知项

## Out Of Scope

- 实际文件上传
- 实际 rich item 发送
- 邮件发送

## Exit Criteria

- 后续 S02/S03 可以在不返工 contract 的前提下开始实现

## Result

- 已完成当前 `ILinkClient` rich media 支持面的本地审计
- 已落地内部附件契约
- 已通过 contract 定向测试
