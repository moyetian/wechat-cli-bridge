# M003 Release Checklist

**Milestone**: M003
**Version Target**: v1.4.0
**Status**: Release Ready

## Code Gate

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] 邮件命令面已具备 `/mail` / `/mailhtml` / `/mailfile`
- [x] 邮件附件发送已复用本地 staging 能力

## Docs Gate

- [x] `README.md` 已同步邮件命令面与 SMTP 配置说明
- [x] `README_CN.md` 已同步邮件命令面与 SMTP 配置说明
- [x] `templates/config.example.json` 已同步 `mail` / `media` 示例
- [x] `GSD/STATE.md` 已同步到 release ready
- [x] milestone `S01` ~ `S05` 文档齐全

## Inbox UAT Gate

- [x] 在本地配置真实 SMTP 凭据
- [x] 在真实收件箱验证 `/mail`
- [x] 在真实收件箱验证 `/mailhtml`
- [x] 在真实收件箱验证 `/mailfile`
- [x] 验证失败路径反馈：缺失附件路径会返回解析后的实际路径

## Open Items Before Public Release

- [x] 准备一套测试 SMTP 凭据并写入本地 `config.json`
- [x] 完成 text / html / attachment 的真实收件箱验收
- [x] 在 UAT 通过后将 `package.json` / startup banner / channel version 提升到 `v1.4.0`
- [ ] 判断是否需要在后续版本增加自然语言邮件入口
