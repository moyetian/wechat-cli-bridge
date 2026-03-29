# S01 UAT: Capability Probe & Media Contract

**Status**: Automated Contract Gate Passed

## Checklist

- [x] 确认当前 `ILinkClient` 只支持文本收发
- [x] 确认附件 metadata 字段清单
- [x] 确认 rich delivery 只纳入微信，不纳入邮件
- [x] 输出后续 S02/S03 所需接口边界

## Automated Evidence

- [x] `npm run build`
- [x] `npx jest src/media/contract.test.ts --runInBand --ci`

## Pass Criteria

- 现状与目标边界清晰
- 不存在“边实现边改 contract”的高风险不确定性
