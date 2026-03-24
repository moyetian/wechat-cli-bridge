import axios, { AxiosInstance } from 'axios';
import { BaseAgent } from './base';
import { AgentConfig, ExecuteOptions, ExecuteResult } from '../types';
import logger from '../utils/logger';

/**
 * HTTP Adapter - OpenAI-compatible API
 * 
 * Supports agents that expose HTTP endpoints:
 * - OpenClaw HTTP fallback
 * - Custom AI servers
 */
export class HTTPAdapter extends BaseAgent {
  private client: AxiosInstance;

  constructor(name: string, config: AgentConfig) {
    super(name, config);

    if (!config.endpoint) {
      throw new Error(`HTTP adapter "${name}" requires endpoint configuration`);
    }

    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: config.timeout || 300000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
      },
    });
  }

  async execute(task: string, options: ExecuteOptions): Promise<ExecuteResult> {
    const startTime = Date.now();

    logger.info(`[${this.name}] Executing task via HTTP: ${task.substring(0, 100)}...`);

    try {
      // Build messages array with context
      const messages: Array<{ role: string; content: string }> = [];

      // Add context as system message
      if (options.context) {
        messages.push({
          role: 'system',
          content: `你是 ${this.name} CLI Agent。以下是项目的上下文信息：\n\n${options.context}`,
        });
      }

      // Add task as user message
      messages.push({
        role: 'user',
        content: task,
      });

      // Make API request
      const response = await this.client.post('/v1/chat/completions', {
        model: this.config.model || 'default',
        messages,
        max_tokens: 4096,
        temperature: 0.7,
      });

      const duration = Date.now() - startTime;
      logger.info(`[${this.name}] Task completed in ${duration}ms`);

      const output = response.data.choices?.[0]?.message?.content || '';
      
      return {
        success: true,
        output,
        summary: this.extractSummary(output),
        filesModified: this.extractModifiedFiles(output),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.name}] HTTP request failed:`, errorMessage);

      return {
        success: false,
        output: '',
        error: errorMessage,
        summary: `HTTP请求失败: ${errorMessage}`,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch {
      // Try models endpoint as fallback
      try {
        const response = await this.client.get('/v1/models', { timeout: 5000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  }
}

export default HTTPAdapter;
