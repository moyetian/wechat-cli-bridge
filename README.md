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

## 功能

**微信发一条消息，背后的 CLI 就去读文件、改代码、跑测试，然后把结果发回微信。**

- 🤖 **多 Agent 支持** - iFlow CLI、Claude Code、Codex、Gemini CLI、OpenClaw
- 🔐 **权限模式** - `interactive` / `acceptEdits` / `auto` / `plan`
- ✅ **审批流** - 待审批请求、批准恢复执行、拒绝和超时失效
- 🖼️ **富媒体下发** - 支持 `/sendimage` 和 `/sendfile` 将本地图片/文件发到当前微信会话
- ✉️ **邮件发送** - 支持 `/mail`、`/mailhtml`、`/mailfile` 走 SMTP 发送正文和附件
- 💾 **上下文管理** - GSD 风格的状态追踪，解决 context rot 问题
- 🔄 **会话持久化** - 断开重连后继续之前的工作
- 🛑 **任务取消** - 支持 /cancel 命令中断长时间运行的任务
- 📁 **目录管理** - 在微信中切换工作目录

> 当前版本已完成 bridge 级权限审批、微信侧 rich delivery，以及 SMTP 邮件发送，并已通过真实收件箱 UAT。

## 原理

```
微信 ClawBot
    │
    ▼
iLink API (HTTP 长轮询，独立协议)
    │
    ▼
Bridge Core (~200行胶水层)
    │
    ├── 上下文管理器 (GSD 风格)
    │
    └── Agent 适配器
            │
            ├── iFlow CLI
            ├── Claude Code
            ├── Codex CLI
            └── Gemini CLI
```

**关键点**：
1. 微信 ClawBot 的 iLink API 是独立的 HTTP 长轮询协议，不依赖 OpenClaw 框架
2. Agent 适配器把 CLI 工具变成统一的执行接口
3. 上下文管理器解决长对话中的 context rot 问题

## 安装

### 前置条件

- Node.js >= 18
- 微信版本 >= 8.0.70
- 至少一个 CLI Agent 已安装（iFlow、Claude Code、Codex、Gemini）

### 步骤

**1. 克隆并安装依赖**

```bash
git clone https://github.com/moyetian/wechat-cli-bridge.git
cd wechat-cli-bridge
npm install
npm run build
```

**2. 在微信中启用 ClawBot**

- 打开微信 → 我 → 设置 → 插件
- 找到「ClawBot」并启用
- 点击进入，复制安装命令

**3. 运行设置向导**

```bash
npm run setup
# 或
npx wechat-cli-bridge setup
```

扫描二维码登录微信 ClawBot。

**4. 启动 Bridge**

```bash
npm start
# 或后台运行
npm run daemon -- start
```

## 使用

### 基本对话

直接发送消息，使用默认 Agent：

```
帮我修复 auth.py 的登录 bug
```

### 指定 Agent

使用前缀指定 Agent：

```
/iflow 重构 user.js 的代码结构
/claude 写一个 React 组件
/codex 添加单元测试
/gemini 分析这段代码的性能问题
```

### 命令

| 命令 | 描述 |
|------|------|
| `/help` | 显示帮助 |
| `/status` | 查看当前状态 |
| `/clear` | 清除上下文 |
| `/history` | 查看任务历史 |
| `/context` | 查看上下文摘要 |
| `/cancel` 或 `/stop` | 取消当前正在执行的任务 |
| `/cd <path>` | 切换工作目录 |
| `/pwd` | 查看当前目录 |
| `/sendfile <path>` | 将本地文件作为附件发送到当前微信会话 |
| `/sendimage <path>` | 将本地图片发送到当前微信会话 |
| `/permission <mode>` | 切换权限模式 |
| `/pending` | 查看待审批请求 |
| `/approve [requestId]` | 批准待审批请求 |
| `/deny [requestId]` | 拒绝待审批请求 |
| `/agent [name]` | 查看/切换 Agent |
| `/mail <to> | <subject> | <body>` | 发送纯文本邮件 |
| `/mailhtml <to> | <subject> | <html>` | 发送 HTML 邮件 |
| `/mailfile <to> | <subject> | <path> | [body]` | 发送带附件邮件 |

### 权限模式

| 模式 | 描述 |
|------|------|
| `interactive` | 只读任务直接执行，编辑/执行/网络/破坏性任务先进入 bridge 审批 |
| `acceptEdits` | 编辑任务直接执行，执行/网络/破坏性任务先进入 bridge 审批 |
| `auto` | 不经过 bridge 审批，直接以最宽松的 CLI mode 执行 |
| `plan` | 不启动 Agent，只返回计划说明 |

审批快捷回复：

- `y` / `yes` / `/approve` → 批准
- `n` / `no` / `/deny` → 拒绝

### 文件与图片下发

```text
/sendimage "./artifacts/demo.png"
/sendfile "./build/My Report.pdf"
```

- 路径包含空格时请使用引号。
- `/sendimage` 只接受受支持图片格式。
- `/sendfile` 会按普通附件发送，即使目标本身是图片。
- 也支持自然语言，例如 `把桌面上的 report.pdf 发给我`。
- 如果你只说“某个文件”，bridge 会追问具体文件名，不会瞎猜。
- 默认限制：
  - 图片 10 MB
  - 文件 25 MB
- 默认会拒绝 `.ssh`、`.git`、`.env` 等敏感路径。

## 配置

默认配置文件位于 `~/.wechat-cli-bridge/config.json`。

如需改到其他目录，可设置环境变量：

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

如需调大或调小媒体大小限制，修改 `config.json` 中的：

- `media.maxImageSizeMB`
- `media.maxFileSizeMB`

如需启用 SMTP 邮件发送，补全并启用 `mail` 段：

- `mail.enabled` 需要设为 `true`
- `mail.from` 是必填发件人地址
- `mail.smtp.secure=true` 通常对应 `465`，如使用 STARTTLS 一般改为 `secure=false` 和 `587`
- SMTP 凭据只应保存在本地 `config.json`，不要发到聊天流或写进 GSD

### Agent 配置说明

**CLI 类型**

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

**HTTP 类型** (OpenAI 兼容 API)

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

```
src/
├── index.ts           # 入口
├── setup.ts           # 设置向导
├── bridge/
│   ├── core.ts        # 核心胶水层 (~200行)
│   └── ilink-client.ts # iLink API 客户端
├── agents/
│   ├── base.ts        # Agent 基类
│   ├── cli-adapter.ts # CLI 适配器
│   ├── http-adapter.ts # HTTP 适配器
│   └── index.ts       # Agent 注册
├── context/
│   └── manager.ts     # 上下文管理器 (GSD 风格)
├── commands/
│   └── handler.ts     # 命令处理器
└── utils/
    ├── logger.ts      # 日志
    └── storage.ts     # 存储
```

### 状态文件

GSD 风格的状态管理：

```
~/.wechat-cli-bridge/
├── config.json        # 全局配置
├── accounts/          # 微信账户凭证
├── sessions/          # 会话状态
│   └── {user_id}/
│       ├── session.json  # 会话元数据
│       ├── STATE.md      # 当前状态
│       ├── CONTEXT.md    # 上下文摘要
│       └── HISTORY.md    # 任务历史
└── logs/              # 日志
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

当前本地自动化验证基线：

```bash
npm run build
npm run lint
npm test -- --runInBand --ci
```

当前测试数：`120`

GitHub Actions 工作流位于 `.github/workflows/ci.yml`，覆盖：

- Ubuntu / Windows
- Node.js 18 / 20
- `build + lint + test`

## 已知限制

1. 任务分类仍是启发式规则，复杂任务可能需要手动复核审批。
2. rich delivery 已通过当前设备 UAT，后续只剩可选的 mixed-mode spot check 与能力扩展。
3. 当前未实现 IMAP / OAuth provider。
4. 当前仍是单账户模型。

## 相关项目

- [wechat-claude-code](https://github.com/Wechat-ggGitHub/wechat-claude-code) - 微信连接 Claude Code 的参考实现
- [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) - 上下文工程框架
- [WeClaw](https://github.com/fastclaw-ai/weclaw) - 微信 ClawBot 桥接工具

## 许可证

MIT

---

<p align="center">
  Made with ❤️ for CLI enthusiasts
</p>
