# M001 Release Checklist

**Milestone**: M001
**Version Target**: v1.2.0
**Status**: Ready For Manual UAT

## Code Gate

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] CI workflow present at `.github/workflows/ci.yml`

## Docs Gate

- [x] `README.md` 已同步当前权限协议和命令面
- [x] `README_CN.md` 已同步当前阶段状态与限制
- [x] `GSD/STATE.md` 已同步到 S05
- [x] milestone `S01` ~ `S05` 文档齐全

## Manual UAT Gate

- [ ] 在真实 ClawBot 环境验证 `/permission interactive`
- [ ] 在真实 ClawBot 环境验证 `/approve` / `/deny`
- [ ] 在真实 ClawBot 环境验证 `acceptEdits`
- [ ] 在真实 ClawBot 环境验证 `plan`

## Open Items Before Public Release

- [x] 确认真实 GitHub 仓库地址并替换 `your-username`
- [ ] 评估是否在下个里程碑纳入“电脑文件发到手机微信端”
- [ ] 评估是否在下个里程碑纳入“邮件发送信息/附件”
