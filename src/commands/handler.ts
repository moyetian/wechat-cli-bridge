import { ParsedCommand, PermissionMode } from '../types';
import { resolveAgentName } from '../agents';
import logger from '../utils/logger';

/**
 * Interface for command definition
 */
export interface CommandInfo {
  description: string;
  requiresArg: boolean;
  argHint?: string;
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
  
  // Permission control
  permission: { 
    description: '切换权限模式', 
    requiresArg: true, 
    argHint: '<interactive|acceptEdits|auto|plan>' 
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
  const parts = text.substring(1).split(/\s+/);
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

/**
 * Validate permission mode
 */
export function isValidPermissionMode(mode: string): mode is PermissionMode {
  return ['interactive', 'acceptEdits', 'auto', 'plan'].includes(mode);
}

/**
 * Get permission mode description
 */
export function getPermissionModeDescription(mode: PermissionMode): string {
  const descriptions: Record<PermissionMode, string> = {
    interactive: '每次工具调用需手动批准',
    acceptEdits: '自动批准文件编辑，其他需批准',
    auto: '自动批准所有操作（危险）',
    plan: '只读模式，不允许任何工具调用',
  };
  return descriptions[mode];
}

/**
 * Generate help text
 */
export function generateHelpText(): string {
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
    if (['status', 'clear', 'history', 'context', 'cancel', 'stop', 'cd', 'pwd', 'permission', 'help', 'workdir', 'agent'].includes(cmd)) {
      const argHint = info.argHint ? ` ${info.argHint}` : '';
      lines.push(`/${cmd}${argHint} - ${info.description}`);
    }
  }

  lines.push('');
  lines.push('## 权限模式');
  lines.push('- interactive: 每次工具调用需手动批准');
  lines.push('- acceptEdits: 自动批准文件编辑');
  lines.push('- auto: 自动批准所有操作（危险）');
  lines.push('- plan: 只读模式');
  lines.push('');
  lines.push('⚠️ 注意: 当前版本权限管控功能正在开发中，默认相当于 auto 模式');
  lines.push('请在安全的沙箱环境下运行！');

  return lines.join('\n');
}

export default {
  parseMessage,
  COMMANDS,
  isValidPermissionMode,
  getPermissionModeDescription,
  generateHelpText,
};