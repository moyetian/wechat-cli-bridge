import { BridgeConfig, AgentConfig } from '../types';
import { BaseAgent, AgentFactory } from './base';
import { CLIAdapter } from './cli-adapter';
import { HTTPAdapter } from './http-adapter';
import logger from '../utils/logger';

// Agent aliases for command routing
export const AGENT_ALIASES: Record<string, string> = {
  // iFlow
  '/if': 'iflow',
  '/iflow': 'iflow',
  
  // Claude Code
  '/cc': 'claude',
  '/claude': 'claude',
  
  // Codex
  '/cx': 'codex',
  '/codex': 'codex',
  
  // Gemini
  '/gm': 'gemini',
  '/gemini': 'gemini',
  
  // OpenClaw
  '/oc': 'openclaw',
  '/openclaw': 'openclaw',
};

/**
 * Create agent from config
 */
function createAgent(name: string, config: AgentConfig): BaseAgent {
  switch (config.type) {
    case 'cli':
      return new CLIAdapter(name, config);
    case 'http':
      return new HTTPAdapter(name, config);
    default:
      throw new Error(`Unknown agent type: ${config.type}`);
  }
}

/**
 * Initialize agents from config
 */
export function initializeAgents(config: BridgeConfig): AgentFactory {
  const factory = new AgentFactory();

  for (const [name, agentConfig] of Object.entries(config.agents)) {
    try {
      const agent = createAgent(name, agentConfig);
      factory.register(name, agent);
      logger.info(`Agent "${name}" registered (${agentConfig.type})`);
    } catch (error) {
      logger.error(`Failed to register agent "${name}":`, error);
    }
  }

  return factory;
}

/**
 * Resolve agent name from alias
 */
export function resolveAgentName(input: string): { agent: string; task: string } | null {
  const trimmed = input.trim();
  
  for (const [alias, agentName] of Object.entries(AGENT_ALIASES)) {
    if (trimmed.toLowerCase().startsWith(alias.toLowerCase())) {
      const task = trimmed.substring(alias.length).trim();
      return { agent: agentName, task };
    }
  }
  
  return null;
}

/**
 * Get default agent configurations
 */
export function getDefaultAgents(): Record<string, AgentConfig> {
  return {
    iflow: {
      type: 'cli',
      command: 'iflow',
      timeout: 600000, // 10 minutes
      permissionProfile: {
        invocationMode: 'positional',
        promptArgs: ['-p'],
        permissionArgs: {
          auto: ['-y'],
        },
      },
    },
    claude: {
      type: 'cli',
      command: 'claude',
      timeout: 600000,
      permissionProfile: {
        invocationMode: 'prompt_flag',
        promptArgs: ['-p'],
        permissionArgs: {
          interactive: ['--permission-mode', 'default'],
          acceptEdits: ['--permission-mode', 'acceptEdits'],
          auto: ['--dangerously-skip-permissions'],
          plan: ['--permission-mode', 'plan'],
        },
      },
    },
    codex: {
      type: 'cli',
      command: 'codex',
      args: ['exec'],
      timeout: 600000,
      permissionProfile: {
        invocationMode: 'positional',
        permissionArgs: {
          auto: ['--full-auto'],
        },
      },
    },
    gemini: {
      type: 'cli',
      command: 'gemini',
      timeout: 600000,
      permissionProfile: {
        invocationMode: 'prompt_flag',
        promptArgs: ['-p'],
        permissionArgs: {
          interactive: ['--approval-mode', 'default'],
          acceptEdits: ['--approval-mode', 'auto_edit'],
          auto: ['--approval-mode', 'yolo'],
          plan: ['--approval-mode', 'default'],
        },
      },
    },
    openclaw: {
      type: 'http',
      endpoint: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8080',
      apiKey: process.env.OPENCLAW_GATEWAY_TOKEN || '',
      model: 'main',
      timeout: 600000,
    },
  };
}
export { BaseAgent, AgentFactory, CLIAdapter, HTTPAdapter };
