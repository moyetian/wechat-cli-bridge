# S01 UAT: Runtime Base & Testability

**Status**: Automated Gate Passed, Manual UAT Pending

## Automated Checklist

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test`

## Manual Checklist

### Default Home Path
- [ ] 删除临时测试产物后启动 bridge
- [ ] 确认默认创建 `~/.wechat-cli-bridge`
- [ ] 确认 `accounts/`、`sessions/`、`logs/`、`projects/` 目录齐全

### Custom/Test Home Path
- [ ] 指定自定义 bridge home
- [ ] 启动 bridge 或测试流程
- [ ] 确认所有运行时文件都落在自定义目录下
- [ ] 确认未污染默认 home 目录

### Import Safety
- [ ] 在测试中仅导入 `logger` 模块，不触发默认 home 写入
- [ ] 在测试中仅导入 `storage` 模块，不触发默认 home 写入

## Pass Criteria

- 自动化检查全部通过
- 手工检查确认路径行为一致
- 后续 S02 可以在稳定测试环境上继续推进
