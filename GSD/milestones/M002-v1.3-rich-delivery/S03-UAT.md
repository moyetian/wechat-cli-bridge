# S03 UAT: WeChat Outbound File/Image Delivery

**Status**: Automated Gate Passed, Device UAT Pending

## Automated Checklist

- [x] `npm run build`
- [x] `npx jest src/bridge/ilink-client.media.test.ts --runInBand --ci`
- [x] `npx jest src/commands/handler.test.ts src/bridge/core.test.ts src/bridge/ilink-client.media.test.ts --runInBand --ci`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`

## Device Checklist

- [ ] 在真实微信会话中发送 `/sendfile <图片路径>`
- [ ] 确认手机微信收到图片
- [ ] 在真实微信会话中发送 `/sendfile <普通文件路径>`
- [ ] 确认手机微信收到文件附件
- [ ] 验证不存在路径时的报错
- [ ] 验证超限文件时的报错

## Pass Criteria

- 自动化检查全部通过
- 手机微信端确认能够收到图片和文件
