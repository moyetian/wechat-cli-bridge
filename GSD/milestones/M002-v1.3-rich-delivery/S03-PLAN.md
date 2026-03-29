# S03 Plan: WeChat Outbound File/Image Delivery

**Milestone**: M002
**Depends On**: S02
**Status**: Implemented

## Slice Goal

将本地 staging 后的附件真正通过 iLink/ClawBot 发送到微信端。

## Must-Haves

### Truths
- 图片和普通文件都能构造正确的 rich `item_list`
- 发图/发文件都要先走 `getuploadurl` 与 CDN AES 上传
- bridge 至少有一个可用命令入口触发发送

### Artifacts
- `ILinkClient.sendLocalMedia()`
- `IMAGE` / `FILE` item 构造
- `/sendfile <path>` 命令
- 协议层与 bridge 入口测试

### Key Links
- `stageLocalMedia -> getuploadurl -> CDN upload -> sendmessage`
- `command handler -> bridge core -> ilink client media sender`

## Result

- 已拿到官方插件实现作为对照
- 已完成协议移植
- 已完成首个 bridge 命令入口
- 自动化验证通过

## Out Of Scope

- 完整图片专用命令
- 更细的错误分类文案
- 真实设备收发验收

## Exit Criteria

- S03 must-haves 全部为真
- S04 可专注于 UX、帮助文案和失败恢复
