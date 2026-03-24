import { ILinkClient } from './ilink-client';
import { AgentFactory, initializeAgents, CLIAdapter } from '../agents';
import { ContextManager } from '../context/manager';
import { parseMessage, isValidPermissionMode, getPermissionModeDescription, generateHelpText } from '../commands/handler';
import { BridgeConfig, WeChatMessage, SessionContext, PermissionMode } from '../types';
import storage from '../utils/storage';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs-extra';

/**
 * Bridge Core - The main orchestrator
 * 
 * Connects WeChat iLink API to CLI agents with context management.
 * Core logic is intentionally kept under 200 lines.
 */
export class Bridge {
  private ilink: ILinkClient;
  private agents: AgentFactory;
  private contextManager: ContextManager;
  private config: BridgeConfig;
  private running: boolean = false;

  // Active task tracking for cancellation
  private activeTasks: Map<string, {
    agentName: string;
    startTime: Date;
  }> = new Map();

  constructor(
    config: BridgeConfig, 
    credentials: { token: string; accountId: string; baseUrl: string }
  ) {
    this.config = config;
    
    // Initialize components
    this.ilink = new ILinkClient(
      credentials.token, 
      credentials.accountId, 
      credentials.baseUrl
    );
    
    this.agents = initializeAgents(config);
    this.contextManager = new ContextManager({
      maxHistory: config.context?.maxHistory || 50,
      summarizeThreshold: config.context?.summarizeThreshold || 20000,
    });

    logger.info('Bridge initialized');
  }

  /**
   * Start the bridge
   */
  async start(): Promise<void> {
    this.running = true;
    logger.info('Bridge starting...');

    // Check available agents
    const available = await this.agents.getAvailable();
    logger.info(`Available agents: ${available.join(', ')}`);

    // Start polling
    for await (const messages of this.ilink.poll()) {
      if (!this.running) break;

      for (const message of messages) {
        await this.handleMessage(message);
      }
    }
  }

  /**
   * Stop the bridge
   */
  stop(): void {
    this.running = false;
    this.ilink.stop();
    logger.info('Bridge stopped');
  }

  /**
   * Handle incoming message - Core logic
   */
  private async handleMessage(message: WeChatMessage): Promise<void> {
    const userId = message.from;
    logger.info(`Message from ${userId}: ${message.text.substring(0, 50)}...`);

    try {
      // 1. Load context
      const context = await this.contextManager.load(userId, {
        defaultAgent: this.config.defaultAgent,
        workingDir: this.config.workingDirectory,
      });

      // 2. Parse message
      const parsed = parseMessage(message.text);

      // 3. Handle command or task
      if (parsed.isCommand) {
        await this.handleCommand(message, context, parsed.command!, parsed.args || []);
      } else {
        await this.handleTask(message, context, parsed.task!, parsed.targetAgent);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error handling message:`, errorMsg);
      await this.ilink.reply(message, `❌ 错误: ${errorMsg}`);
    }
  }

  /**
   * Handle command
   */
  private async handleCommand(
    message: WeChatMessage,
    context: SessionContext,
    command: string,
    args: string[]
  ): Promise<void> {
    const token = message.contextToken;

    switch (command) {
      case 'help':
        await this.ilink.sendMarkdown(message.from, generateHelpText(), token);
        break;

      case 'status':
        await this.sendStatus(message.from, context, token);
        break;

      case 'clear':
        await this.contextManager.clear(message.from);
        await this.ilink.reply(message, '✅ 上下文已清除，开始新会话');
        break;

      case 'history':
        const history = await storage.getStateFile(message.from, 'HISTORY.md');
        await this.ilink.sendMarkdown(message.from, history || '暂无历史记录', token);
        break;

      case 'context':
        const summary = await this.contextManager.getSummary(message.from);
        await this.ilink.sendMarkdown(message.from, summary || '暂无上下文', token);
        break;

      case 'cancel':
      case 'stop':
        await this.cancelCurrentTask(message);
        break;

      case 'cd':
        const newDir = args[0];
        if (!newDir) {
          await this.ilink.reply(message, `当前目录: ${context.workingDir}`);
        } else {
          const resolved = path.resolve(context.workingDir, newDir);
          if (await fs.pathExists(resolved)) {
            context.workingDir = resolved;
            await this.contextManager.save(context);
            await this.ilink.reply(message, `✅ 切换到: ${resolved}`);
          } else {
            await this.ilink.reply(message, `❌ 目录不存在: ${resolved}`);
          }
        }
        break;

      case 'pwd':
      case 'workdir':
        await this.ilink.reply(message, `📁 工作目录: ${context.workingDir}`);
        break;

      case 'permission':
        const mode = args[0]?.toLowerCase();
        if (!mode || !isValidPermissionMode(mode)) {
          await this.ilink.reply(message, 
            `当前模式: ${context.permissionMode}\n` +
            `可用模式: interactive, acceptEdits, auto, plan\n` +
            `⚠️ 注意: 当前版本权限管控功能正在开发中`
          );
        } else {
          context.permissionMode = mode as PermissionMode;
          await this.contextManager.save(context);
          await this.ilink.reply(message, 
            `✅ 权限模式已切换: ${mode}\n${getPermissionModeDescription(mode as PermissionMode)}\n` +
            `⚠️ 注意: 当前版本权限管控功能正在开发中`
          );
        }
        break;

      case 'agent':
        if (args[0]) {
          if (this.agents.has(args[0])) {
            context.defaultAgent = args[0];
            await this.contextManager.save(context);
            await this.ilink.reply(message, `✅ 已切换到: ${args[0]}`);
          } else {
            await this.ilink.reply(message, `❌ 未知 Agent: ${args[0]}\n可用: ${this.agents.list().join(', ')}`);
          }
        } else {
          await this.ilink.reply(message, 
            `当前 Agent: ${context.defaultAgent}\n` +
            `可用: ${this.agents.list().join(', ')}`
          );
        }
        break;

      default:
        await this.ilink.reply(message, `未知命令: /${command}\n发送 /help 查看帮助`);
    }
  }

  /**
   * Cancel current running task
   */
  private async cancelCurrentTask(message: WeChatMessage): Promise<void> {
    const userId = message.from;
    const activeTask = this.activeTasks.get(userId);

    if (!activeTask) {
      await this.ilink.reply(message, '⚠️ 没有正在执行的任务');
      return;
    }

    // Get the agent and kill its process
    const agent = this.agents.get(activeTask.agentName);
    if (agent && agent instanceof CLIAdapter) {
      agent.kill();
      this.activeTasks.delete(userId);
      await this.ilink.reply(message, 
        `✅ 已取消任务\n` +
        `执行时长: ${Math.round((Date.now() - activeTask.startTime.getTime()) / 1000)}秒`
      );
      logger.info(`Task cancelled for user ${userId}`);
    } else {
      await this.ilink.reply(message, '⚠️ 无法取消该类型的任务');
    }
  }

  /**
   * Handle task execution
   */
  private async handleTask(
    message: WeChatMessage,
    context: SessionContext,
    task: string,
    targetAgent?: string
  ): Promise<void> {
    const userId = message.from;
    const agentName = targetAgent || context.defaultAgent;
    const agent = this.agents.get(agentName);

    if (!agent) {
      await this.ilink.reply(message, `❌ Agent 不可用: ${agentName}`);
      return;
    }

    // Check if already running a task
    if (this.activeTasks.has(userId)) {
      await this.ilink.reply(message, '⚠️ 已有任务正在执行，请先发送 /cancel 取消');
      return;
    }

    // Track active task
    this.activeTasks.set(userId, {
      agentName,
      startTime: new Date(),
    });

    // Get context summary
    const contextSummary = await this.contextManager.getSummary(userId);

    // Execute
    await this.ilink.reply(message, `🔄 正在执行 (${agentName})...`);

    try {
      const result = await agent.execute(task, {
        workingDir: context.workingDir,
        sessionId: context.sessionId,
        context: contextSummary,
      });

      // Update context
      await this.contextManager.update(userId, {
        task,
        result: result.summary,
        agent: agentName,
        success: result.success,
        filesModified: result.filesModified,
      });

      // Send result
      const statusIcon = result.success ? '✅' : '❌';
      
      // Build response with output (not just summary)
      let response: string;
      
      if (result.output && result.output.length > 0) {
        // Include actual output for file reading/content tasks
        response = `${statusIcon} ${result.summary}\n\n${result.output}`;
      } else {
        response = `${statusIcon} ${result.summary}`;
      }
      
      if (result.filesModified && result.filesModified.length > 0) {
        response += `\n\n📝 修改的文件:\n${result.filesModified.map(f => `- ${f}`).join('\n')}`;
      }
      
      if (!result.success && result.error) {
        response += `\n\n❌ 错误: ${result.error.substring(0, 500)}`;
      }

      await this.ilink.reply(message, response);
    } finally {
      // Clear active task
      this.activeTasks.delete(userId);
    }
  }

  /**
   * Send status information
   */
  private async sendStatus(to: string, context: SessionContext, contextToken?: string): Promise<void> {
    const activeTask = this.activeTasks.get(to);
    
    const lines: string[] = [
      '# 当前状态',
      '',
      `**Agent**: ${context.defaultAgent}`,
      `**工作目录**: ${context.workingDir}`,
      `**权限模式**: ${context.permissionMode}`,
      `**会话 ID**: ${context.sessionId.substring(0, 8)}...`,
      '',
      `**已完成任务**: ${context.state.completedTasks.length}`,
      `**最近修改**: ${context.state.recentFiles.length} 个文件`,
    ];

    if (activeTask) {
      const duration = Math.round((Date.now() - activeTask.startTime.getTime()) / 1000);
      lines.push('', '**🔄 正在执行任务**', `Agent: ${activeTask.agentName}`, `已运行: ${duration}秒`);
    }

    if (context.state.blockers.length > 0) {
      lines.push('', '**阻塞项**:');
      context.state.blockers.forEach(b => lines.push(`- ${b}`));
    }

    await this.ilink.sendMarkdown(to, lines.join('\n'), contextToken);
  }
}

export default Bridge;