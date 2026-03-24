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
- 💾 **上下文管理** - GSD 风格的状态追踪，解决 context rot 问题
- 🔄 **会话持久化** - 断开重连后继续之前的工作
- 🛑 **任务取消** - 支持 /cancel 命令中断长时间运行的任务
- 📁 **目录管理** - 在微信中切换工作目录
- ✂️ **消息分片** - 自动拆分长消息以适应微信 2000 字符限制

> ⚠️ **权限管控功能正在开发中**：当前版本默认相当于 Auto 模式，请在安全的沙箱环境下运行！

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
npm run daemon start
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
| `/permission <mode>` | 切换权限模式（开发中） |
| `/agent [name]` | 查看/切换 Agent |

### 权限模式

> ⚠️ **注意**：权限管控功能正在开发中，当前版本默认相当于 Auto 模式

| 模式 | 描述 |
|------|------|
| `interactive` | 每次工具调用需手动批准（计划中） |
| `acceptEdits` | 自动批准文件编辑，其他需批准（计划中） |
| `auto` | 自动批准所有操作（当前默认，危险） |
| `plan` | 只读模式，不允许任何工具调用（计划中） |

## 配置

配置文件位于 `~/.wechat-cli-bridge/config.json`

```json
{
  "defaultAgent": "iflow",
  "workingDirectory": "~/projects",
  "agents": {
    "iflow": {
      "type": "cli",
      "command": "iflow",
      "args": ["-y"],
      "timeout": 600000
    },
    "claude": {
      "type": "cli",
      "command": "claude",
      "args": ["-p", "--dangerously-skip-permissions"]
    },
    "codex": {
      "type": "cli",
      "command": "codex",
      "args": ["-p", "--dangerously-bypass-all"]
    },
    "gemini": {
      "type": "cli",
      "command": "gemini",
      "args": ["-y"]
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
  }
}
```

### Agent 配置说明

**CLI 类型**

```json
{
  "type": "cli",
  "command": "iflow",
  "args": ["-y"],
  "timeout": 600000
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

## 开发路线

| 版本 | 目标 | 状态 |
|------|------|------|
| v1.0 | MVP - 核心功能 | ✅ 已完成 |
| v1.1 | 稳定性提升 | 📋 计划中 |
| v1.2 | 权限管控 | 📋 计划中 |
| v1.3 | 多媒体支持 | 📋 计划中 |
| v1.4 | 多 Agent 协作 | 📋 计划中 |
| v2.0 | 平台化 | 🔮 未来规划 |

## 已知限制

1. **权限管控功能** - 开发中，当前为 auto 模式
2. **消息长度限制** - 2000 字符（已支持自动分片）
3. **多账户支持** - 当前仅支持单账户

## 开发

```bash
# 开发模式
npm run dev

# 编译
npm run build

# 运行
npm start
```

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

[English Documentation](./README.md)