# S03 UAT: Approval State Machine

**Status**: Automated Gate Passed, Manual UAT Pending

## Automated Checklist

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`

## Manual Checklist

### Approval Creation
- [ ] 切换到 `/permission interactive`
- [ ] 发送一个明显修改文件的任务
- [ ] 确认 bridge 不会立刻执行
- [ ] 确认收到审批提示和 request ID

### Approval Decision
- [ ] 回复 `y` 或 `/approve`
- [ ] 确认任务开始执行
- [ ] 再次发起待审批任务后回复 `n` 或 `/deny`
- [ ] 确认任务不会执行

### Pending Block
- [ ] 在一个待审批任务存在时再发送新任务
- [ ] 确认 bridge 返回“当前有任务待审批”

### Expiration
- [ ] 创建待审批任务
- [ ] 等待超时
- [ ] 尝试 `/approve`
- [ ] 确认任务不会被恢复执行

## Pass Criteria

- 自动化检查全部通过
- 手工验证确认审批流在真实 ClawBot 环境中可用
- 可进入 S04
