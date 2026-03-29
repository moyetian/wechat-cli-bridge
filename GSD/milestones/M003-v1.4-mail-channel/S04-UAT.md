# S04 UAT: WeChat Command UX

**Status**: Passed

## Automated Evidence

- [x] `npm run build`
- [x] `npx jest src/commands/handler.test.ts src/bridge/core.test.ts --runInBand --ci`

## Manual Checklist

- [x] 在真实微信会话中执行 `/mail`
- [x] 在真实微信会话中执行 `/mailhtml`
- [x] 在真实微信会话中执行 `/mailfile`
- [x] 验证错误路径反馈可定位到解析后的附件路径
