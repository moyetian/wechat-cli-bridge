import { ParsedCommand } from '../types';
import { resolveAgentName } from '../agents';
import {
  getPermissionModeDescription,
  isValidPermissionMode,
  PERMISSION_MODES,
} from '../permissions/contract';
import {
  MAX_WECHAT_FILE_SIZE_BYTES,
  MAX_WECHAT_IMAGE_SIZE_BYTES,
} from '../media/staging';
import logger from '../utils/logger';

/**
 * Interface for command definition
 */
export interface CommandInfo {
  description: string;
  requiresArg: boolean;
  argHint?: string;
}

export interface HelpTextOptions {
  maxImageSizeMB?: number;
  maxFileSizeMB?: number;
}

/**
 * Available commands
 */
export const COMMANDS: Record<string, CommandInfo> = {
  // Agent switching
  iflow: { description: '切换到 iFlow CLI', requiresArg: false },
  claude: { description: '切换到 Claude Code', requiresArg: false },
  codex: { description: '切换到 Codex CLI', requiresArg: false },
  gemini: { description: '切换到 Gemini CLI', requiresArg: false },
  openclaw: { description: '切换到 OpenClaw', requiresArg: false },
  
  // Session management
  status: { description: '查看当前状态', requiresArg: false },
  clear: { description: '清除上下文（开始新任务）', requiresArg: false },
  history: { description: '查看任务历史', requiresArg: false },
  context: { description: '查看上下文摘要', requiresArg: false },
  
  // Task control
  cancel: { description: '取消当前正在执行的任务', requiresArg: false },
  stop: { description: '停止当前任务（同 cancel）', requiresArg: false },
  
  // Directory management
  cd: { description: '切换工作目录', requiresArg: true, argHint: '<path>' },
  pwd: { description: '查看当前工作目录', requiresArg: false },
  sendfile: { description: '以文件附件发送本地文件', requiresArg: true, argHint: '<path>' },
  sendimage: { description: '发送本地图片到当前微信会话', requiresArg: true, argHint: '<path>' },
  mail: { description: '发送纯文本邮件', requiresArg: true, argHint: '<to> | <subject> | <body>' },
  mailhtml: { description: '发送 HTML 邮件', requiresArg: true, argHint: '<to> | <subject> | <html>' },
  mailfile: {
    description: '发送带附件邮件',
    requiresArg: true,
    argHint: '<to> | <subject> | <path> | [body]',
  },
  
  // Permission control
  permission: { 
    description: '切换权限模式', 
    requiresArg: true, 
    argHint: '<interactive|acceptEdits|auto|plan>' 
  },
  pending: {
    description: '查看待审批请求',
    requiresArg: false,
  },
  approve: {
    description: '批准待审批请求',
    requiresArg: false,
    argHint: '[requestId]',
  },
  deny: {
    description: '拒绝待审批请求',
    requiresArg: false,
    argHint: '[requestId]',
  },
  
  // Help
  help: { description: '显示帮助信息', requiresArg: false },
  
  // Misc
  workdir: { description: '查看当前工作目录', requiresArg: false },
  agent: { description: '查看/切换当前 Agent', requiresArg: false },
};

/**
 * Parse message to extract command or task
 */
export function parseMessage(text: string): ParsedCommand {
  const trimmed = text.trim();
  
  // Check for command prefix
  if (trimmed.startsWith('/')) {
    return parseCommand(trimmed);
  }
  
  // Check for agent alias at start
  const agentMatch = resolveAgentName(trimmed);
  if (agentMatch) {
    return {
      isCommand: false,
      task: agentMatch.task,
      targetAgent: agentMatch.agent,
    };
  }
  
  // Regular task
  return {
    isCommand: false,
    task: trimmed,
  };
}

/**
 * Parse command from text
 */
function parseCommand(text: string): ParsedCommand {
  const parts = tokenizeCommand(text.substring(1).trim());
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  // Check if it's an agent command
  if (['iflow', 'claude', 'codex', 'gemini', 'openclaw'].includes(cmd || '')) {
    // If there are more parts, it's a task for that agent
    if (args.length > 0) {
      return {
        isCommand: false,
        task: args.join(' '),
        targetAgent: cmd,
      };
    }
    // Otherwise it's a switch command
    return {
      isCommand: true,
      command: 'agent',
      args: [cmd],
    };
  }

  // Check if it's a known command
  if (cmd && COMMANDS[cmd]) {
    return {
      isCommand: true,
      command: cmd,
      args,
    };
  }

  // Unknown command - treat as task
  logger.warn(`Unknown command: ${cmd}`);
  return {
    isCommand: false,
    task: text,
  };
}

function tokenizeCommand(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | '\'' | null = null;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }

      if (char === '\\' && text[index + 1] === quote) {
        current += quote;
        index++;
        continue;
      }

      current += char;
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Generate help text
 */
export function generateHelpText(options: HelpTextOptions = {}): string {
  const maxImageSizeBytes =
    (options.maxImageSizeMB || MAX_WECHAT_IMAGE_SIZE_BYTES / (1024 * 1024)) * 1024 * 1024;
  const maxFileSizeBytes =
    (options.maxFileSizeMB || MAX_WECHAT_FILE_SIZE_BYTES / (1024 * 1024)) * 1024 * 1024;
  const lines: string[] = [
    '# WeChat CLI Bridge 帮助',
    '',
    '## Agent 命令',
    '直接发送消息会使用默认 Agent，或使用前缀指定:',
    '```',
    '/iflow <任务>  → 使用 iFlow 执行任务',
    '/claude <任务> → 使用 Claude Code 执行任务',
    '/codex <任务>  → 使用 Codex 执行任务',
    '/gemini <任务> → 使用 Gemini 执行任务',
    '```',
    '',
    '## 会话管理',
  ];

  for (const [cmd, info] of Object.entries(COMMANDS)) {
    if ([
      'status',
      'clear',
      'history',
      'context',
      'cancel',
      'stop',
      'cd',
      'pwd',
      'sendfile',
      'sendimage',
      'mail',
      'mailhtml',
      'mailfile',
      'permission',
      'pending',
      'approve',
      'deny',
      'help',
      'workdir',
      'agent',
    ].includes(cmd)) {
      const argHint = info.argHint ? ` ${info.argHint}` : '';
      lines.push(`/${cmd}${argHint} - ${info.description}`);
    }
  }

  lines.push('');
  lines.push('## 权限模式');
  for (const mode of PERMISSION_MODES) {
    lines.push(`- ${mode}: ${getPermissionModeDescription(mode)}`);
  }
  lines.push('');
  lines.push('## 媒体发送');
  lines.push('- 路径含空格时请用引号包起来，例如 `/sendfile "./build/My Report.pdf"`');
  lines.push('- 也支持自然语言，例如 `把桌面上的 report.pdf 发给我`');
  lines.push(`- 图片当前限制: ${formatBytes(maxImageSizeBytes)}`);
  lines.push(`- 文件当前限制: ${formatBytes(maxFileSizeBytes)}`);
  lines.push('- 会阻止 `.ssh`、`.git`、`.env` 等敏感路径');
  lines.push('');
  lines.push('## 邮件发送');
  lines.push('- `/mail to@example.com | Subject | Body`');
  lines.push('- `/mailhtml to@example.com | Subject | <p>HTML</p>`');
  lines.push('- `/mailfile to@example.com | Subject | ./report.pdf | Body`');
  lines.push('');
  lines.push('## 审批命令');
  lines.push('- /pending: 查看当前待审批请求');
  lines.push('- /approve [requestId]: 批准一个待审批请求');
  lines.push('- /deny [requestId]: 拒绝一个待审批请求');

  return lines.join('\n');
}

export default {
  parseMessage,
  COMMANDS,
  isValidPermissionMode,
  getPermissionModeDescription,
  generateHelpText,
};

export { isValidPermissionMode, getPermissionModeDescription };
