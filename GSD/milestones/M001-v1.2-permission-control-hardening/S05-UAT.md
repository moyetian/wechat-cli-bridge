# S05 UAT: Release Gate

**Status**: Automated Gate Passed, Manual UAT Pending

## Automated Checklist

- [x] CI workflow YAML 可解析
- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`

## Manual Release Checklist

- [ ] 在真实 ClawBot 环境完成一轮完整权限流测试
- [ ] 复核 README 中的安装与启动命令
- [ ] 确认 GitHub 仓库 metadata 不再使用占位符
- [ ] 确认下一里程碑已记录“文件下发”和“邮件发送”能力缺口

## Pass Criteria

- 自动化门全部通过
- 手工发布前检查全部完成
- 可将 M001 标记为发布就绪
