# S04 UAT: UX, Safety & Failure Recovery

**Status**: Automated Gate Passed, Core Device UAT Passed

## Automated Checklist

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `npx jest src/commands/handler.test.ts src/media/staging.test.ts src/bridge/ilink-client.media.test.ts src/bridge/core.test.ts --runInBand --ci`

## Device Checklist

### Happy Paths
- [x] 在真实微信会话中发送 `/sendimage "<图片路径>"`
- [x] 确认手机微信收到图片
- [x] 在真实微信会话中发送 `/sendfile "<普通文件路径>"`
- [x] 确认手机微信收到普通文件附件
- [ ] 在真实微信会话中发送 `/sendfile "<图片路径>"`
- [ ] 确认图片被当作普通附件而不是内联图片发送

### Failure Paths
- [x] 发送不存在路径
- [x] 确认收到“路径不存在”报错
- [x] 使用 `/sendimage` 发送非图片文件
- [x] 确认收到“类型不支持”报错
- [x] 发送超限文件
- [x] 确认收到“超过大小限制”报错
- [x] 发送敏感路径（如 `.ssh/id_rsa` 或 `.env`）
- [x] 确认 bridge 明确拒绝发送

## Pass Criteria

- 自动化检查全部通过
- 手机微信端确认图片和文件都可按预期收到
- 失败路径在微信端能给出明确、可操作的反馈
- `/sendfile "<图片路径>"` 的设备 spot check 可作为后续非阻塞验证项
