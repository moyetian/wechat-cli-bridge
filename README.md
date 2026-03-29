# WeChat CLI Bridge

<p align="center">
  <strong>Control CLI agents from WeChat</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#architecture">Architecture</a>
</p>

---

WeChat CLI Bridge lets you control CLI agents such as iFlow, Claude Code, Codex, Gemini, and OpenClaw from WeChat ClawBot, and send results back to the current WeChat conversation.

## Features

- **Multi-agent support**: iFlow CLI, Claude Code, Codex, Gemini CLI, OpenClaw
- **Permission modes**: `interactive` / `acceptEdits` / `auto` / `plan`
- **Approval flow**: pending approvals, approve/resume, deny, timeout expiry
- **Rich delivery**: send local images and files to the current WeChat conversation with `/sendimage` and `/sendfile`
- **Mail delivery**: send text, HTML, and attachments over SMTP with `/mail`, `/mailhtml`, `/mailfile`
- **QR login**: sign in with WeChat QR code
- **Context management**: GSD-style state tracking
- **Cross-platform**: Windows and Linux

## Current Status

- `v1.2` permission control hardening is complete
- `v1.3` rich delivery is complete and has passed real-device UAT
- `v1.4` mail channel has passed real inbox UAT and is release ready

## How It Works

```text
WeChat ClawBot
    │
    ▼
iLink API (HTTP long polling, standalone protocol)
    │
    ▼
Bridge Core
    │
    ├── Context manager (GSD style)
    │
    └── Agent adapters
            │
            ├── iFlow CLI
            ├── Claude Code
            ├── Codex CLI
            └── Gemini CLI
```

Key points:

1. WeChat ClawBot uses the standalone iLink HTTP long-polling protocol and does not depend on OpenClaw.
2. Agent adapters normalize different CLI tools behind one execution interface.
3. The context manager reduces context rot in long-running conversations.

## Installation

### Prerequisites

- Node.js >= 18
- WeChat >= 8.0.70
- At least one CLI agent installed locally: iFlow, Claude Code, Codex, or Gemini

### Steps

1. Clone the repository and install dependencies.

```bash
git clone https://github.com/moyetian/wechat-cli-bridge.git
cd wechat-cli-bridge
npm install
npm run build
```

2. Enable ClawBot inside WeChat.

- Open WeChat -> Me -> Settings -> Plugins
- Enable `ClawBot`
- Open it and copy the install command

3. Run the setup wizard.

```bash
npm run setup
# or
npx wechat-cli-bridge setup
```

Scan the QR code to sign in to WeChat ClawBot.

4. Start the bridge.

```bash
npm start
# or run as a daemon
npm run daemon -- start
```

## Usage

### Basic Conversation

Send a message directly to use the default agent:

```text
Fix the login bug in auth.py
```

### Select an Agent Explicitly

Use an agent prefix at the start of the message:

```text
/iflow Refactor the structure of user.js
/claude Build a React component
/codex Add unit tests
/gemini Analyze the performance of this code
```

### Common Commands

| Command | Description |
|------|------|
| `/help` | Show help |
| `/status` | Show current status |
| `/iflow <task>` | Run a task with iFlow |
| `/claude <task>` | Run a task with Claude Code |
| `/codex <task>` | Run a task with Codex |
| `/gemini <task>` | Run a task with Gemini |
| `/sendimage <path>` | Send a local image to the current WeChat conversation |
| `/sendfile <path>` | Send a local file as an attachment to the current WeChat conversation |
| `/mail <to> \| <subject> \| <body>` | Send a plain-text email |
| `/mailhtml <to> \| <subject> \| <html>` | Send an HTML email |
| `/mailfile <to> \| <subject> \| <path> \| [body]` | Send an email with an attachment |
| `/permission <mode>` | Change the permission mode |
| `/pending` | Show pending approval requests |
| `/approve [requestId]` | Approve a pending request |
| `/deny [requestId]` | Deny a pending request |

### Permission Behavior

| Mode | Behavior |
|------|------|
| `interactive` | Read-only tasks run directly; edit/execute/network/destructive tasks require bridge approval first |
| `acceptEdits` | Edit tasks run directly; execute/network/destructive tasks require bridge approval first |
| `auto` | Run without bridge approval |
| `plan` | Do not start the agent; return a plan only |

Approval shortcuts:

- `y` / `yes` / `/approve`: approve
- `n` / `no` / `/deny`: deny

### File And Image Delivery

```text
/sendimage "./artifacts/demo.png"
/sendfile "./build/My Report.pdf"
```

- Quote the path if it contains spaces.
- `/sendimage` only accepts supported image formats.
- `/sendfile` always sends the target as a normal file attachment, even if the file is an image.
- Natural-language requests are also supported, for example: `Send the report.pdf on my Desktop to me`.
- If you only say `some file`, the bridge asks a clarification question instead of guessing.
- Default limits:
  - Images: 10 MB
  - Files: 25 MB
- Sensitive paths such as `.ssh`, `.git`, and `.env` are rejected by default.

## Configuration

The default config file lives at `~/.wechat-cli-bridge/config.json`.

To place it somewhere else, set:

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

To change media size limits, update:

- `media.maxImageSizeMB`
- `media.maxFileSizeMB`

### Mail Configuration

To enable `/mail`, `/mailhtml`, and `/mailfile`, complete and enable the `mail` section:

- `mail.enabled` must be `true`
- `mail.from` is required
- `mail.smtp.secure=true` usually goes with port `465`
- For STARTTLS, use `secure=false` with port `587`
- Keep SMTP credentials in local `config.json` only, not in chat messages or GSD notes

### Agent Configuration

CLI example:

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

HTTP example (OpenAI-compatible API):

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

```text
src/
├── index.ts            # entry point
├── setup.ts            # setup wizard
├── bridge/
│   ├── core.ts         # bridge core
│   └── ilink-client.ts # iLink API client
├── agents/
│   ├── base.ts         # base agent
│   ├── cli-adapter.ts  # CLI adapter
│   ├── http-adapter.ts # HTTP adapter
│   └── index.ts        # agent registry
├── context/
│   └── manager.ts      # GSD-style context manager
├── commands/
│   └── handler.ts      # command handler
└── utils/
    ├── logger.ts       # logging
    └── storage.ts      # storage
```

### Runtime State Layout

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

## Development

```bash
# development mode
npm run dev

# build
npm run build

# run
npm start
```

## Verification

Current local verification baseline:

```bash
npm run build
npm run lint
npm test -- --runInBand --ci
```

Current test count: `121`

GitHub Actions workflow: `.github/workflows/ci.yml`

- Ubuntu / Windows
- Node.js 18 / 20
- `build + lint + test`

## Known Limitations

1. Task classification is still heuristic. Complex requests may still require manual review.
2. Rich delivery has already passed current-device UAT. Remaining work is optional spot checks and capability expansion.
3. IMAP and OAuth-based mail providers are not implemented yet.
4. Multi-account support is not implemented yet.

## Related Projects

- [wechat-claude-code](https://github.com/Wechat-ggGitHub/wechat-claude-code)
- [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done)
- [WeClaw](https://github.com/fastclaw-ai/weclaw)

## License

MIT

---

[中文文档](./README_CN.md)
