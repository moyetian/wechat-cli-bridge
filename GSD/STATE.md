# State: WeChat CLI Bridge

**Last Updated**: 2026-03-29
**Session**: 2026-03-29

## Current Status

**Phase**: M003 Release Ready - Mail Channel
**Status**: `M002` 已保持 release ready；`M003-v1.4-mail-channel` 已完成 `S01` 到 `S05`，并已通过真实 SMTP 收件箱 UAT。版本口径、文档、release checklist 和实际能力现已统一到 `v1.4.0`

## Completed Recently

### M002 S04 实施
- [x] 为 rich delivery 增加显式图片入口 `/sendimage <path>`
- [x] 为命令解析增加带引号参数支持，允许带空格路径
- [x] 将 `ILinkClient.sendLocalMedia()` 改为结构化结果，区分 staging / upload / send 失败
- [x] 为本地媒体发送增加默认大小限制
  - 图片：10 MB
  - 文件：25 MB
- [x] 增加敏感路径保护，默认阻止 `.ssh`、`.git`、`.env` 等高风险路径
- [x] 增加图片格式保护，`/sendimage` 仅允许受支持图片格式
- [x] 允许 `/sendfile` 将图片按普通附件发送，避免命令语义混乱
- [x] 更新帮助文本，补充路径引号和大小限制提示

### M002 S05 实施
- [x] 将版本口径更新到 `v1.3.0`
- [x] 更新 `README.md` 到当前 rich delivery 能力
- [x] 更新 `README_CN.md` 到当前阶段状态、命令面和限制
- [x] 新增 `M002` 的 `S05-PLAN.md`
- [x] 新增 `M002` 的 `S05-UAT.md`
- [x] 新增 `M002` 的 `RELEASE-CHECKLIST.md`
- [x] 同步根级 `STATE.md` / `ROADMAP.md` / `HISTORY.md`

### 真实设备 UAT
- [x] 在真实微信会话中验证 `/sendimage /tmp/wcb-uat-assets/uat-image.png`
- [x] 确认图片可以正常打开
- [x] 在真实微信会话中验证 `/sendfile /tmp/wcb-uat-assets/uat-file.txt`
- [x] 确认文件可以正常下载打开
- [x] 验证失败路径：
  - 不存在路径
  - 错误图片类型
  - 敏感路径
  - 超限文件
- [x] 修正协议层关键问题：
  - 为 CDN 上传增加重试与更详细错误展开
  - 将 `aes_key` 编码改为与官方插件一致的 hex-string-base64 格式

### 发布后易用性补强
- [x] 支持自然语言直接发文件/图片请求
  - 例如：`把桌面上的 report.pdf 发给我`
  - 例如：`把 "./build/report.pdf" 发给我`
- [x] 对“某个文件”这类模糊请求进行追问，而不是盲目猜测
- [x] 支持桌面文件名匹配与显式路径解析
- [x] 在真实微信会话中验证自然语言桌面文件发送
  - `把桌面上的中国高铁运营路线图发给我` → 正确识别为桌面图片，但因 19 MB 超过 10 MB 图片限制被拒绝
  - `把桌面上的 Weixin.exe.lnk 发给我` → 正常收到文件
- [x] 支持通过 `config.json` 调整媒体大小限制
  - `media.maxImageSizeMB`
  - `media.maxFileSizeMB`

### M003 S01 实施
- [x] 锁定 `v1.4` 首版 provider 为 `SMTP`
- [x] 新增邮件地址、收件人、正文、附件与草稿契约
- [x] 新增 SMTP config normalization、readiness 与 summary helper
- [x] 保留 `mail_attachment` 与现有 media layer 的连接点
- [x] 落盘 `M003` 的 roadmap/context/research/S01 文档

### M003 S02/S03/S04 实施
- [x] 安装 `nodemailer`
- [x] 新增 `SMTPMailSender`
- [x] 支持 SMTP text/html 发信
- [x] 将邮件附件发送接入现有 `media staging`
- [x] 新增 `/mail`、`/mailhtml`、`/mailfile`
- [x] 增加收件人校验与附件准备错误提示
- [x] 更新 README / README_CN 到当前邮件命令面

### M003 S05 收口启动
- [x] 审核本地 bridge home，确认当前没有可直接复用的 SMTP 凭据
- [x] 新增 `M003` 的 `S05-PLAN.md`
- [x] 新增 `M003` 的 `S05-UAT.md`
- [x] 新增 `M003` 的 `RELEASE-CHECKLIST.md`
- [x] 同步 `README.md` / `README_CN.md` 的 SMTP 配置说明
- [x] 同步 `templates/config.example.json` 到当前 `media` / `mail` 结构
- [x] 回写根级 `STATE.md` / `ROADMAP.md` / `HISTORY.md`

### M003 真实收件箱 UAT 与发布门收口
- [x] 在本地 UAT config 中写入真实 SMTP 凭据
- [x] 通过 SMTP verify 确认 Gmail 登录可用
- [x] 在真实微信会话中验证 `/mail`
- [x] 在真实微信会话中验证 `/mailhtml`
- [x] 在真实微信会话中验证 `/mailfile`
- [x] 用 direct SMTP probe 复核 HTML-only 与附件投递链路
- [x] 为 `/mailhtml` 增加 plain-text fallback，提升收件端兼容性
- [x] 为 `/mailfile` 失败反馈补解析路径，便于定位用户输入问题
- [x] 将 `package.json` / startup banner / channel version 提升到 `v1.4.0`

### 自动化验证
- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `npx jest src/mail/contract.test.ts src/mail/config.test.ts src/mail/smtp-sender.test.ts --runInBand --ci`
- [x] 测试总数提升到 `120`

## Active Milestone

**Milestone**: `M003-v1.4-mail-channel`

### Slice Order
- [x] S01 - Mail Contract & Provider Decision
- [x] S02 - SMTP Text/HTML Delivery
- [x] S03 - Attachment Delivery
- [x] S04 - WeChat Command UX
- [x] S05 - UAT & Release Gate

## Key Constraints

1. **M003 首版只做 SMTP 发信** - 不在当前里程碑引入 IMAP、OAuth 或 provider-specific API
2. **不重复发明附件底座** - 邮件附件优先复用现有 `media staging`
3. **不把凭据写进聊天流或 GSD** - SMTP 账号密码只进本地配置
4. **M002 保持 release ready，不返工微信链路** - 邮件能力作为独立通道推进

## Known Limitations

1. **IMAP 收信未实现** - 当前只覆盖发信
2. **OAuth provider 未实现** - 当前只覆盖通用 SMTP
3. **多账户支持缺失** - 当前仍为单账户模型

## Next Steps

- [ ] 评估是否进入 `M004`
- [ ] 评估是否增加自然语言邮件入口

## Verification Reality

### Current Re-check (2026-03-29)
```bash
npm run build                # ✅ passed
npm run lint                 # ✅ passed
npm test -- --runInBand --ci # ✅ 120 tests passed
npx jest src/mail/contract.test.ts src/mail/config.test.ts src/mail/smtp-sender.test.ts --runInBand --ci # ✅ passed
```

### Previous Milestone Reality
- `M002-v1.3-rich-delivery` 已达 release ready
- 图片/文件 happy path 与 failure path 已在真实微信会话中验证通过
