# WeChat CLI Bridge

<p align="center">
  <strong>Control CLI Agents through WeChat</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## Features

**Send a message on WeChat, and the CLI agent reads files, modifies code, runs tests, then sends results back to WeChat.**

- 🤖 **Multi-Agent Support** - iFlow CLI, Claude Code, Codex, Gemini CLI, OpenClaw
- 💾 **Context Management** - GSD-style state tracking, solves context rot problem
- 🔄 **Session Persistence** - Resume work after reconnection
- 🛑 **Task Cancellation** - Support `/cancel` command to interrupt long-running tasks
- 📁 **Directory Management** - Switch working directories via WeChat
- ✂️ **Message Splitting** - Auto-split long messages to fit WeChat's 2000 char limit

> ⚠️ **Permission control is under development**: Current version defaults to Auto mode. Please run in a safe sandbox environment!

## How It Works

```
WeChat ClawBot
    │
    ▼
iLink API (HTTP Long Polling, standalone protocol)
    │
    ▼
Bridge Core (~200 lines glue layer)
    │
    ├── Context Manager (GSD Style)
    │
    └── Agent Adapters
            │
            ├── iFlow CLI
            ├── Claude Code
            ├── Codex CLI
            └── Gemini CLI
```

**Key Points**:
1. WeChat ClawBot's iLink API is a standalone HTTP long-polling protocol, independent of OpenClaw framework
2. Agent adapters unify CLI tools into a single execution interface
3. Context manager solves context rot in long conversations

## Installation

### Prerequisites

- Node.js >= 18
- WeChat version >= 8.0.70
- At least one CLI Agent installed (iFlow, Claude Code, Codex, or Gemini)

### Steps

**1. Clone and install dependencies**

```bash
git clone https://github.com/moyetian/wechat-cli-bridge.git
cd wechat-cli-bridge
npm install
npm run build
```

**2. Enable ClawBot in WeChat**

- Open WeChat → Me → Settings → Plugins
- Find "ClawBot" and enable it
- Click to enter and copy the installation command

**3. Run setup wizard**

```bash
npm run setup
# or
npx wechat-cli-bridge setup
```

Scan the QR code to login to WeChat ClawBot.

**4. Start the Bridge**

```bash
npm start
# or run in background
npm run daemon start
```

## Usage

### Basic Conversation

Send a message directly to use the default Agent:

```
Help me fix the login bug in auth.py
```

### Specify Agent

Use prefix to specify Agent:

```
/iflow Refactor the code structure of user.js
/claude Write a React component
/codex Add unit tests
/gemini Analyze the performance of this code
```

### Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/status` | View current status |
| `/clear` | Clear context |
| `/history` | View task history |
| `/context` | View context summary |
| `/cancel` or `/stop` | Cancel current running task |
| `/cd <path>` | Change working directory |
| `/pwd` | Show current directory |
| `/permission <mode>` | Switch permission mode (in development) |
| `/agent [name]` | View/switch Agent |

### Permission Modes

> ⚠️ **Note**: Permission control is under development, current version defaults to Auto mode

| Mode | Description |
|------|-------------|
| `interactive` | Manual approval for each tool call (planned) |
| `acceptEdits` | Auto-approve file edits, others need approval (planned) |
| `auto` | Auto-approve all operations (current default, dangerous) |
| `plan` | Read-only mode, no tool calls allowed (planned) |

## Configuration

Config file located at `~/.wechat-cli-bridge/config.json`

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

### Agent Configuration

**CLI Type**

```json
{
  "type": "cli",
  "command": "iflow",
  "args": ["-y"],
  "timeout": 600000
}
```

**HTTP Type** (OpenAI compatible API)

```json
{
  "type": "http",
  "endpoint": "http://localhost:8080",
  "apiKey": "your-api-key",
  "model": "main"
}
```

## Architecture

### Core Modules

```
src/
├── index.ts           # Entry point
├── setup.ts           # Setup wizard
├── bridge/
│   ├── core.ts        # Core glue layer (~200 lines)
│   └── ilink-client.ts # iLink API client
├── agents/
│   ├── base.ts        # Agent base class
│   ├── cli-adapter.ts # CLI adapter
│   ├── http-adapter.ts # HTTP adapter
│   └── index.ts       # Agent registration
├── context/
│   └── manager.ts     # Context manager (GSD style)
├── commands/
│   └── handler.ts     # Command handler
└── utils/
    ├── logger.ts      # Logging
    └── storage.ts     # Storage
```

### State Files

GSD-style state management:

```
~/.wechat-cli-bridge/
├── config.json        # Global config
├── accounts/          # WeChat account credentials
├── sessions/          # Session states
│   └── {user_id}/
│       ├── session.json  # Session metadata
│       ├── STATE.md      # Current state
│       ├── CONTEXT.md    # Context summary
│       └── HISTORY.md    # Task history
└── logs/              # Logs
```

## Roadmap

| Version | Goal | Status |
|---------|------|--------|
| v1.0 | MVP - Core functionality | ✅ Complete |
| v1.1 | Stability improvements | 📋 Planned |
| v1.2 | Permission control | 📋 Planned |
| v1.3 | Rich media support | 📋 Planned |
| v1.4 | Multi-Agent collaboration | 📋 Planned |
| v2.0 | Platform features | 🔮 Future |

## Known Limitations

1. **Permission Control** - Under development, currently in auto mode
2. **Message Length** - 2000 character limit (auto-split with part indicators)
3. **Multi-Account** - Currently supports single account only

## Development

```bash
# Development mode
npm run dev

# Build
npm run build

# Run
npm start
```

## Related Projects

- [wechat-claude-code](https://github.com/Wechat-ggGitHub/wechat-claude-code) - Reference implementation for WeChat + Claude Code
- [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) - Context engineering framework
- [WeClaw](https://github.com/fastclaw-ai/weclaw) - WeChat ClawBot bridge tools

## License

MIT

---

<p align="center">
  Made with ❤️ for CLI enthusiasts
</p>

[中文文档](./README_CN.md)