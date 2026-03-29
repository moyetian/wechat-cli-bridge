# S03 Plan: Attachment Delivery

**Milestone**: M003
**Depends On**: S02
**Status**: Implemented

## Slice Goal

复用现有本地附件 staging 能力，把文件作为邮件附件发送出去。

## Result

- 已在邮件发送路径中复用 `stageLocalMedia`
- 已支持 `mail_attachment` intent
- 已接入邮件附件大小限制
- 已补 `/mailfile` 主路径测试
