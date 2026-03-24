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
      args: ['-y'], // --yolo: 自动接受所有操作
      timeout: 600000, // 10 minutes
    },
    claude: {
      type: 'cli',
      command: 'claude',
      args: ['-p', '--dangerously-skip-permissions'],
      timeout: 600000,
    },
    codex: {
      type: 'cli',
      command: 'codex',
      args: ['-p', '--dangerously-bypass-all'], // 跳过所有权限确认
      timeout: 600000,
    },
    gemini: {
      type: 'cli',
      command: 'gemini',
      args: ['-y'], // --yolo: 自动接受所有操作
      timeout: 600000,
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
