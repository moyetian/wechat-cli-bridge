# WeChat CLI Bridge

> 让微信控制 CLI Agent 干活

一个桥接工具，让你可以通过微信 ClawBot 控制 CLI Agent（iFlow、Claude Code、Codex、Gemini、OpenClaw）执行编程任务，并把结果回传到当前微信会话。

## 当前能力

- **多 Agent 支持**: iFlow CLI、Claude Code、Codex、Gemini CLI、OpenClaw
- **权限模式**: `interactive` / `acceptEdits` / `auto` / `plan`
- **审批流**: 待审批请求、批准恢复、拒绝和超时失效
- **富媒体下发**: 支持 `/sendimage`、`/sendfile` 从本机发送图片和文件到当前微信会话
- **邮件发送**: 支持 `/mail`、`/mailhtml`、`/mailfile` 走 SMTP 发送正文和附件
- **二维码登录**: 微信扫码即可认证
- **上下文管理**: GSD 风格的状态追踪
- **跨平台**: 支持 Windows / Linux

## 当前状态

- `v1.2` 权限管控与执行加固已完成
- `v1.3` rich delivery 已完成实现与真实设备 UAT
- `v1.4` mail channel 已完成真实收件箱 UAT，当前达到 release ready

## 常用命令

| 命令 | 描述 |
|------|------|
| `/help` | 显示帮助 |
| `/status` | 查看当前状态 |
| `/iflow <task>` | 用 iFlow 执行任务 |
| `/claude <task>` | 用 Claude Code 执行任务 |
| `/codex <task>` | 用 Codex 执行任务 |
| `/gemini <task>` | 用 Gemini 执行任务 |
| `/sendimage <path>` | 发送本地图片到当前微信会话 |
| `/sendfile <path>` | 将本地文件作为附件发送到当前微信会话 |
| `/mail <to> | <subject> | <body>` | 发送纯文本邮件 |
| `/mailhtml <to> | <subject> | <html>` | 发送 HTML 邮件 |
| `/mailfile <to> | <subject> | <path> | [body]` | 发送带附件邮件 |
| `/permission <mode>` | 切换权限模式 |
| `/pending` | 查看待审批请求 |
| `/approve [requestId]` | 批准待审批请求 |
| `/deny [requestId]` | 拒绝待审批请求 |

## 文件与图片下发

```text
/sendimage "./artifacts/demo.png"
/sendfile "./build/My Report.pdf"
```

- 路径包含空格时请使用引号。
- `/sendimage` 仅接受受支持图片格式。
- `/sendfile` 会按普通附件发送，即使目标本身是图片。
- 也支持自然语言，例如 `把桌面上的 report.pdf 发给我`。
- 如果只说“某个文件”，bridge 会先追问具体文件名。
- 默认限制：
  - 图片 10 MB
  - 文件 25 MB
- 默认会拒绝 `.ssh`、`.git`、`.env` 等敏感路径。

## 当前权限行为

| 模式 | 行为 |
|------|------|
| `interactive` | 只读任务直接执行，其余任务先审批 |
| `acceptEdits` | 编辑任务直接执行，执行/网络/破坏性任务先审批 |
| `auto` | 不经 bridge 审批，直接执行 |
| `plan` | 不启动 Agent，只返回计划 |

审批快捷回复：

- `y` / `yes` / `/approve`：批准
- `n` / `no` / `/deny`：拒绝

## 验证

```bash
npm run build
npm run lint
npm test -- --runInBand --ci
```

当前测试数：`120`

如需修改媒体大小限制，可在 `config.json` 中调整：

- `media.maxImageSizeMB`
- `media.maxFileSizeMB`

## 邮件配置

如需启用 `/mail`、`/mailhtml`、`/mailfile`，在本地 `config.json` 中补全 `mail` 段：

```json
{
  "mail": {
    "enabled": true,
    "provider": "smtp",
    "from": "bot@example.com",
    "replyTo": "bot@example.com",
    "defaultTo": ["you@example.com"],
    "maxAttachmentSizeMB": 25,
    "smtp": {
      "host": "smtp.example.com",
      "port": 465,
      "secure": true,
      "user": "bot@example.com",
      "pass": "app-password"
    }
  }
}
```

- `mail.from` 是必填发件人地址。
- `mail.enabled` 需要设为 `true` 才会实际发信。
- 如使用 STARTTLS，一般改为 `secure=false` 和 `port=587`。
- SMTP 凭据只保存在本地配置，不要发到聊天流或写进 GSD。

## 已知限制

1. **任务分类仍是启发式规则** - 复杂任务可能需要手动复核审批
2. **rich delivery 已通过当前设备 UAT** - 后续只剩可选的 mixed-mode spot check 与能力扩展，不再阻塞发布
3. **IMAP / OAuth** - 当前未实现
4. **多账户支持** - 当前仅支持单账户

## 许可证

MIT

---

**最后更新**: 2026-03-29

[English Documentation](./README.md)
