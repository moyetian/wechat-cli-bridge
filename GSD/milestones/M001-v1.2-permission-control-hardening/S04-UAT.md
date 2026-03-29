# S04 UAT: Agent Enforcement

**Status**: Automated Gate Passed, Manual UAT Pending

## Automated Checklist

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`

## Manual Checklist

### Mode Difference
- [ ] 在 `interactive` 模式下发起编辑任务
- [ ] 确认先进入 bridge 待审批
- [ ] 批准后确认 CLI 不会再卡在终端权限确认

### AcceptEdits
- [ ] 切换到 `acceptEdits`
- [ ] 发送普通编辑任务
- [ ] 确认直接执行，不进入 bridge 审批
- [ ] 发送网络/执行类任务
- [ ] 确认仍进入 bridge 审批

### Auto
- [ ] 切换到 `auto`
- [ ] 发送编辑任务与执行任务
- [ ] 确认 bridge 不额外审批，任务直接执行

### Plan Boundary
- [ ] 创建一个待审批任务
- [ ] 将 mode 切到 `plan`
- [ ] 显式 `/approve`
- [ ] 确认已批准任务仍可恢复执行
- [ ] 新发任务在 `plan` 下仍不会执行

## Pass Criteria

- 自动化检查全部通过
- 手工验证确认各 mode 在真实 CLI 上行为差异成立
- 可以进入 S05
