# S02 UAT: Permission Contract

**Status**: Automated Gate Passed, Manual UAT Pending

## Automated Checklist

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`

## Manual Checklist

### Permission Defaults
- [ ] 删除现有 session 后启动 bridge
- [ ] 确认新 session 的 permission mode 与 config 一致

### Command Surface
- [ ] 发送 `/pending`
- [ ] 确认在无待审批请求时返回明确提示
- [ ] 发送 `/approve`
- [ ] 确认在无请求时不会报异常
- [ ] 发送 `/deny`
- [ ] 确认在无请求时不会报异常

### Session Persistence
- [ ] 通过测试或调试工具写入审批请求
- [ ] 重启 bridge
- [ ] 确认 `/pending` 仍能看到待审批请求

## Pass Criteria

- 自动化检查全部通过
- 手工验证确认命令面和 session 契约正常工作
- 可无阻塞进入 S03
