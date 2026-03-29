# S05 UAT: UAT & Release Gate

**Status**: Passed

## Automated Checklist

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `README.md` 已同步邮件命令面与 SMTP 配置说明
- [x] `README_CN.md` 已同步邮件命令面与 SMTP 配置说明
- [x] `templates/config.example.json` 已同步 `media` / `mail` 示例
- [x] `RELEASE-CHECKLIST.md` 已创建

## Manual Inbox Checklist

- [x] 在本地 `config.json` 中准备真实 SMTP 凭据
- [x] 使用 `/mail <to> | <subject> | <body>` 发送纯文本邮件
- [x] 使用 `/mailhtml <to> | <subject> | <html>` 发送 HTML 邮件
- [x] 使用 `/mailfile <to> | <subject> | <path> | [body]` 发送本地附件
- [x] 验证错误路径：缺失附件路径会回显解析后的实际路径
- [x] 确认凭据未进入聊天流、日志摘要或 GSD 文档

## Manual Evidence

- 已在真实微信会话中验证 `/mail`、`/mailhtml`、`/mailfile`
- 已确认目标收件箱成功收到 text / html / attachment
- 已用 direct SMTP probe 复核 HTML-only 与附件投递链路

## Pass Criteria

- 自动化门全部通过
- 真实 SMTP inbox UAT 通过
- 发布前人工检查完成
- 可以将 M003 标记为发布就绪并切换版本口径到 `v1.4.0`
