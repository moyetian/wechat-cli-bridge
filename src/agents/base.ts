import { AgentConfig, ExecuteOptions, ExecuteResult } from '../types';
import logger from '../utils/logger';

/**
 * Base Agent Adapter
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected name: string;

  constructor(name: string, config: AgentConfig) {
    this.name = name;
    this.config = config;
    logger.debug(`Agent "${name}" initialized with type: ${config.type}`);
  }

  /**
   * Execute a task
   */
  abstract execute(task: string, options: ExecuteOptions): Promise<ExecuteResult>;

  /**
   * Check if agent is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get agent name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get agent type
   */
  getType(): string {
    return this.config.type;
  }

  /**
   * Format task with context
   * Only include context if there's meaningful history
   */
  protected formatTaskWithInput(task: string, context?: string): string {
    // Skip context if empty or only basic info (new session)
    if (!context || context.trim().length < 20) {
      return task;
    }

    // Use clear separator format that won't confuse the agent
    return `---历史上下文---
${context}
---当前任务---
${task}`;
  }

  /**
   * Extract summary from output
   */
  protected extractSummary(output: string): string {
    // Try to extract key information from output
    const lines = output.split('\n').filter(l => l.trim());
    
    // Look for common summary patterns
    const summaryPatterns = [
      /(?:完成|completed|done|finished)[:：]\s*(.+)/i,
      /(?:结果|result)[:：]\s*(.+)/i,
      /(?:总结|summary)[:：]\s*(.+)/i,
    ];

    for (const pattern of summaryPatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
    }

    // Return first meaningful line
    const meaningfulLine = lines.find(l => 
      l.length > 10 && 
      !l.startsWith('#') && 
      !l.startsWith('>')
    );
    
    return meaningfulLine || '任务执行完成';
  }

  /**
   * Extract modified files from output
   */
  protected extractModifiedFiles(output: string): string[] {
    const files: string[] = [];
    
    // Common patterns for file modifications
    const patterns = [
      /(?:修改|修改了?|modified|edited)[:：]?\s*([^\s]+\.[a-zA-Z]+)/gi,
      /(?:创建|创建了?|created)[:：]?\s*([^\s]+\.[a-zA-Z]+)/gi,
      /(?:删除|删除了?|deleted)[:：]?\s*([^\s]+\.[a-zA-Z]+)/gi,
      /(?:写入|wrote?)[to去]?\s*([^\s]+\.[a-zA-Z]+)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const file = match[1].trim();
        if (!files.includes(file)) {
          files.push(file);
        }
      }
    }

    return files;
  }
}

/**
 * Agent Factory
 */
export class AgentFactory {
  private agents: Map<string, BaseAgent> = new Map();

  register(name: string, agent: BaseAgent): void {
    this.agents.set(name, agent);
    logger.info(`Registered agent: ${name}`);
  }

  get(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }

  list(): string[] {
    return Array.from(this.agents.keys());
  }

  async getAvailable(): Promise<string[]> {
    const available: string[] = [];
    for (const [name, agent] of this.agents) {
      if (await agent.isAvailable()) {
        available.push(name);
      }
    }
    return available;
  }
}

export default BaseAgent;
