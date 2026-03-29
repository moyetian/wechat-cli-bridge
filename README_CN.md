# WeChat CLI Bridge

<p align="center">
  <strong>让微信控制 CLI Agent 干活</strong>
</p>

<p align="center">
  <a href="#功能">功能</a> •
  <a href="#安装">安装</a> •
  <a href="#使用">使用</a> •
  <a href="#配置">配置</a> •
  <a href="#架构">架构</a>
</p>

---

WeChat CLI Bridge 让你可以通过微信 ClawBot 控制 iFlow、Claude Code、Codex、Gemini、OpenClaw 等 CLI Agent，并把结果回传到当前微信会话。

## 功能

- **多 Agent 支持**：iFlow CLI、Claude Code、Codex、Gemini CLI、OpenClaw
- **权限模式**：`interactive` / `acceptEdits` / `auto` / `plan`
- **审批流**：待审批请求、批准恢复、拒绝和超时失效
- **富媒体下发**：支持用 `/sendimage`、`/sendfile` 向当前微信会话发送本地图片和文件
- **邮件发送**：支持用 `/mail`、`/mailhtml`、`/mailfile` 通过 SMTP 发送正文和附件
- **二维码登录**：支持微信扫码登录
- **上下文管理**：支持 GSD 风格状态追踪
- **跨平台**：支持 Windows 和 Linux

## 当前状态

- `v1.2` 权限管控加固已完成
- `v1.3` rich delivery 已完成实现并通过真实设备 UAT
- `v1.4` mail channel 已通过真实收件箱 UAT，当前已达到 release ready

## 原理

```text
微信 ClawBot
    │
    ▼
iLink API（HTTP 长轮询，独立协议）
    │
    ▼
Bridge Core
    │
    ├── 上下文管理器（GSD 风格）
    │
    └── Agent 适配器
            │
            ├── iFlow CLI
            ├── Claude Code
            ├── Codex CLI
            └── Gemini CLI
```

关键点：

1. 微信 ClawBot 使用独立的 iLink HTTP 长轮询协议，不依赖 OpenClaw。
2. Agent 适配器把不同 CLI 工具统一成同一套执行接口。
3. 上下文管理器用于降低长对话中的 context rot。

## 安装

### 前置条件

- Node.js >= 18
- 微信 >= 8.0.70
- 本地至少安装一个 CLI Agent：iFlow、Claude Code、Codex 或 Gemini

### 步骤

1. 克隆仓库并安装依赖。

```bash
git clone https://github.com/moyetian/wechat-cli-bridge.git
cd wechat-cli-bridge
npm install
npm run build
```

2. 在微信中启用 ClawBot。

- 打开微信 -> 我 -> 设置 -> 插件
- 启用 `ClawBot`
- 进入后复制安装命令

3. 运行设置向导。

```bash
npm run setup
# 或
npx wechat-cli-bridge setup
```

扫描二维码登录微信 ClawBot。

4. 启动 bridge。

```bash
npm start
# 或后台运行
npm run daemon -- start
```

## 使用

### 基本对话

直接发消息，使用默认 Agent：

```text
帮我修复 auth.py 的登录 bug
```

### 显式指定 Agent

在消息开头加 agent 前缀：

```text
/iflow 重构 user.js 的代码结构
/claude 写一个 React 组件
/codex 添加单元测试
/gemini 分析这段代码的性能问题
```

### 常用命令

| 命令 | 描述 |
|------|------|
| `/help` | 显示帮助 |
| `/status` | 查看当前状态 |
| `/iflow <task>` | 用 iFlow 执行任务 |
| `/claude <task>` | 用 Claude Code 执行任务 |
| `/codex <task>` | 用 Codex 执行任务 |
| `/gemini <task>` | 用 Gemini 执行任务 |
| `/sendimage <path>` | 向当前微信会话发送本地图片 |
| `/sendfile <path>` | 向当前微信会话发送本地文件附件 |
| `/mail <to> \| <subject> \| <body>` | 发送纯文本邮件 |
| `/mailhtml <to> \| <subject> \| <html>` | 发送 HTML 邮件 |
| `/mailfile <to> \| <subject> \| <path> \| [body]` | 发送带附件邮件 |
| `/permission <mode>` | 切换权限模式 |
| `/pending` | 查看待审批请求 |
| `/approve [requestId]` | 批准待审批请求 |
| `/deny [requestId]` | 拒绝待审批请求 |

### 权限行为

| 模式 | 行为 |
|------|------|
| `interactive` | 只读任务直接执行；编辑/执行/网络/破坏性任务先经过 bridge 审批 |
| `acceptEdits` | 编辑任务直接执行；执行/网络/破坏性任务先经过 bridge 审批 |
| `auto` | 不经过 bridge 审批，直接执行 |
| `plan` | 不启动 agent，只返回计划 |

审批快捷回复：

- `y` / `yes` / `/approve`：批准
- `n` / `no` / `/deny`：拒绝

### 文件与图片下发

```text
/sendimage "./artifacts/demo.png"
/sendfile "./build/My Report.pdf"
```

- 如果路径包含空格，请使用引号。
- `/sendimage` 仅接受受支持图片格式。
- `/sendfile` 总是按普通文件附件发送，即使目标本身是图片。
- 也支持自然语言请求，例如：`把桌面上的 report.pdf 发给我`。
- 如果你只说“某个文件”，bridge 会先追问，不会盲猜。
- 默认限制：
  - 图片：10 MB
  - 文件：25 MB
- `.ssh`、`.git`、`.env` 等敏感路径会被默认拒绝。

## 配置

默认配置文件位于 `~/.wechat-cli-bridge/config.json`。

如果想改到其他目录，可设置：

```bash
export WECHAT_CLI_BRIDGE_HOME=/path/to/bridge-home
```

```json
{
  "defaultAgent": "iflow",
  "workingDirectory": "~/projects",
  "agents": {
    "iflow": {
      "type": "cli",
      "command": "iflow",
      "timeout": 300000
    },
    "claude": {
      "type": "cli",
      "command": "claude",
      "timeout": 300000
    },
    "openclaw": {
      "type": "http",
      "endpoint": "http://localhost:8080",
      "apiKey": "your-api-key"
    }
  },
  "context": {
    "maxHistory": 50,
    "summarizeThreshold": 20000
  },
  "permission": {
    "mode": "auto",
    "timeout": 120
  },
  "media": {
    "maxImageSizeMB": 10,
    "maxFileSizeMB": 25
  },
  "mail": {
    "enabled": false,
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

如需调整媒体大小限制，修改：

- `media.maxImageSizeMB`
- `media.maxFileSizeMB`

### 邮件配置

如需启用 `/mail`、`/mailhtml`、`/mailfile`，请补全并启用 `mail` 段：

- `mail.enabled` 需要设为 `true`
- `mail.from` 是必填字段
- `mail.smtp.secure=true` 通常对应端口 `465`
- 如果使用 STARTTLS，通常设为 `secure=false` 且端口为 `587`
- SMTP 凭据只保存在本地 `config.json` 中，不要写进聊天消息或 GSD 文档

### Agent 配置

CLI 示例：

```json
{
  "type": "cli",
  "command": "iflow",
  "timeout": 300000,
  "permissionProfile": {
    "invocationMode": "positional",
    "promptArgs": ["-p"],
    "permissionArgs": {
      "auto": ["-y"]
    }
  }
}
```

HTTP 示例（OpenAI-compatible API）：

```json
{
  "type": "http",
  "endpoint": "http://localhost:8080",
  "apiKey": "your-api-key",
  "model": "main"
}
```

## 架构

### 核心模块

```text
src/
├── index.ts            # 入口
├── setup.ts            # 设置向导
├── bridge/
│   ├── core.ts         # bridge 核心
│   └── ilink-client.ts # iLink API 客户端
├── agents/
│   ├── base.ts         # base agent
│   ├── cli-adapter.ts  # CLI 适配器
│   ├── http-adapter.ts # HTTP 适配器
│   └── index.ts        # agent 注册
├── context/
│   └── manager.ts      # GSD 风格上下文管理器
├── commands/
│   └── handler.ts      # 命令处理器
└── utils/
    ├── logger.ts       # 日志
    └── storage.ts      # 存储
```

### 运行时状态布局

```text
~/.wechat-cli-bridge/
├── config.json
├── accounts/
├── sessions/
│   └── {user_id}/
│       ├── session.json
│       ├── STATE.md
│       ├── CONTEXT.md
│       └── HISTORY.md
└── logs/
```

## 开发

```bash
# 开发模式
npm run dev

# 编译
npm run build

# 运行
npm start
```

## 验证

当前本地验证基线：

```bash
npm run build
npm run lint
npm test -- --runInBand --ci
```

当前测试数：`121`

GitHub Actions workflow：`.github/workflows/ci.yml`

- Ubuntu / Windows
- Node.js 18 / 20
- `build + lint + test`

## 已知限制

1. 任务分类仍然是启发式规则，复杂请求可能仍然需要人工复核。
2. rich delivery 已通过当前设备 UAT，剩余工作主要是可选抽查和能力扩展。
3. 目前尚未实现 IMAP 和 OAuth 邮件 provider。
4. 目前尚未实现多账户支持。

## 相关项目

- [wechat-claude-code](https://github.com/Wechat-ggGitHub/wechat-claude-code)
- [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done)
- [WeClaw](https://github.com/fastclaw-ai/weclaw)

## 许可证

MIT

---

[English Documentation](./README.md)
