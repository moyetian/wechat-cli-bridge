import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { SessionContext, ContextState, TaskRecord, Decision, ProjectInfo } from '../types';
import storage from '../utils/storage';
import logger from '../utils/logger';

const DEFAULT_STATE: ContextState = {
  completedTasks: [],
  pendingItems: [],
  decisions: [],
  blockers: [],
  recentFiles: [],
};

/**
 * Context Manager - GSD-style state management
 * 
 * Manages session context with:
 * - STATE.md: Current state
 * - CONTEXT.md: Context summary
 * - HISTORY.md: Task history
 */
export class ContextManager {
  private maxHistory: number;
  private summarizeThreshold: number;

  constructor(options: { maxHistory?: number; summarizeThreshold?: number } = {}) {
    this.maxHistory = options.maxHistory || 50;
    this.summarizeThreshold = options.summarizeThreshold || 20000;
  }

  /**
   * Load session context for user
   */
  async load(userId: string, defaults: Partial<SessionContext> = {}): Promise<SessionContext> {
    // Try to load existing session
    const existingSession = await storage.getSession(userId);
    
    if (existingSession) {
      // Load state file
      const stateContent = await storage.getStateFile(userId, 'STATE.md');
      const state = stateContent ? this.parseStateMd(stateContent) : DEFAULT_STATE;

      // Load context summary
      const summary = await storage.getStateFile(userId, 'CONTEXT.md') || '';

      return {
        userId,
        sessionId: existingSession.sessionId as string,
        defaultAgent: existingSession.defaultAgent as string || defaults.defaultAgent || 'iflow',
        workingDir: existingSession.workingDir as string || defaults.workingDir || process.cwd(),
        projectName: existingSession.projectName as string,
        summary,
        state,
        lastActivity: new Date(existingSession.lastActivity as string || Date.now()),
        permissionMode: existingSession.permissionMode as 'interactive' || 'interactive',
        ...defaults,
      };
    }

    // Create new session
    const newSession: SessionContext = {
      userId,
      sessionId: uuidv4(),
      defaultAgent: defaults.defaultAgent || 'iflow',
      workingDir: defaults.workingDir || process.cwd(),
      summary: '',
      state: { ...DEFAULT_STATE },
      lastActivity: new Date(),
      permissionMode: 'interactive',
      ...defaults,
    };

    // Save initial state
    await this.save(newSession);

    return newSession;
  }

  /**
   * Save session context
   */
  async save(context: SessionContext): Promise<void> {
    await storage.setSession(context.userId, {
      sessionId: context.sessionId,
      defaultAgent: context.defaultAgent,
      workingDir: context.workingDir,
      projectName: context.projectName,
      lastActivity: new Date().toISOString(),
      permissionMode: context.permissionMode,
    });

    // Save STATE.md
    await storage.setStateFile(
      context.userId,
      'STATE.md',
      this.generateStateMd(context)
    );
  }

  /**
   * Update context after task execution
   */
  async update(
    userId: string,
    update: {
      task?: string;
      result?: string;
      agent?: string;
      success?: boolean;
      filesModified?: string[];
      decision?: string;
      blocker?: string;
    }
  ): Promise<void> {
    const context = await this.load(userId);

    // Add to completed tasks
    if (update.task && update.result) {
      const record: TaskRecord = {
        task: update.task,
        result: update.result,
        agent: update.agent || context.defaultAgent,
        success: update.success ?? true,
        timestamp: new Date(),
      };
      context.state.completedTasks.push(record);

      // Trim if exceeds max
      if (context.state.completedTasks.length > this.maxHistory) {
        context.state.completedTasks = context.state.completedTasks.slice(-this.maxHistory);
      }
    }

    // Update recent files
    if (update.filesModified && update.filesModified.length > 0) {
      context.state.recentFiles = [
        ...update.filesModified,
        ...context.state.recentFiles.filter(f => !update.filesModified!.includes(f)),
      ].slice(0, 20);
    }

    // Add decision
    if (update.decision) {
      context.state.decisions.push({
        decision: update.decision,
        timestamp: new Date(),
      });
    }

    // Add/remove blocker
    if (update.blocker) {
      context.state.blockers.push(update.blocker);
    }

    context.lastActivity = new Date();

    // Check if we need to summarize
    const historyLength = JSON.stringify(context.state.completedTasks).length;
    if (historyLength > this.summarizeThreshold) {
      await this.summarizeAndCompact(userId, context);
    } else {
      await this.save(context);
    }

    // Append to HISTORY.md
    await this.appendHistory(userId, update);
  }

  /**
   * Clear context (start fresh)
   */
  async clear(userId: string): Promise<void> {
    await storage.clearSession(userId);
    logger.info(`Context cleared for user: ${userId}`);
  }

  /**
   * Get context summary for agent input
   */
  async getSummary(userId: string): Promise<string> {
    const context = await this.load(userId);
    
    if (context.summary) {
      return context.summary;
    }

    // Generate summary from state
    return this.generateSummary(context);
  }

  /**
   * Generate context summary
   */
  private generateSummary(context: SessionContext): string {
    const parts: string[] = [];

    // Only include meaningful context, not just basic info
    const hasHistory = context.state.completedTasks.length > 0 ||
                       context.state.recentFiles.length > 0 ||
                       context.state.decisions.length > 0 ||
                       context.state.blockers.length > 0 ||
                       context.summary;

    if (!hasHistory) {
      // Return empty for new sessions - agent doesn't need context summary
      return '';
    }

    if (context.projectName) {
      parts.push(`项目: ${context.projectName}`);
    }

    if (context.state.completedTasks.length > 0) {
      parts.push('## 最近完成的任务');
      const recent = context.state.completedTasks.slice(-5);
      for (const task of recent) {
        const icon = task.success ? '✅' : '❌';
        parts.push(`${icon} ${task.task.substring(0, 100)}`);
      }
    }

    if (context.state.recentFiles.length > 0) {
      parts.push('## 最近修改的文件');
      parts.push(context.state.recentFiles.slice(0, 10).join('\n'));
    }

    if (context.state.decisions.length > 0) {
      parts.push('## 关键决策');
      const recent = context.state.decisions.slice(-5);
      for (const d of recent) {
        parts.push(`- ${d.decision}`);
      }
    }

    if (context.state.blockers.length > 0) {
      parts.push('## 当前阻塞');
      parts.push(context.state.blockers.map(b => `- ${b}`).join('\n'));
    }

    return parts.join('\n');
  }

  /**
   * Summarize and compact history
   */
  private async summarizeAndCompact(userId: string, context: SessionContext): Promise<void> {
    logger.info(`Summarizing context for user: ${userId}`);

    // Generate comprehensive summary
    const summary = this.generateSummary(context);
    
    // Keep only last 10 tasks
    context.state.completedTasks = context.state.completedTasks.slice(-10);
    
    // Update summary
    context.summary = summary;

    // Save compacted state
    await this.save(context);
    await storage.setStateFile(userId, 'CONTEXT.md', summary);

    logger.info('Context compacted successfully');
  }

  /**
   * Append to HISTORY.md
   */
  private async appendHistory(
    userId: string,
    update: { task?: string; result?: string; success?: boolean; agent?: string }
  ): Promise<void> {
    if (!update.task) return;

    const timestamp = new Date().toISOString();
    const icon = update.success ? '✅' : '❌';
    const entry = [
      `\n## [${timestamp}]`,
      `${icon} **任务**: ${update.task}`,
      `**Agent**: ${update.agent}`,
      `**结果**: ${update.result}`,
    ].join('\n');

    const existing = await storage.getStateFile(userId, 'HISTORY.md') || '';
    await storage.setStateFile(userId, 'HISTORY.md', existing + entry);
  }

  /**
   * Parse STATE.md content
   */
  private parseStateMd(content: string): ContextState {
    const state: ContextState = { ...DEFAULT_STATE };

    // Simple markdown parsing
    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSection = line.substring(3).toLowerCase();
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const item = line.substring(2);
        
        switch (currentSection) {
          case 'completed tasks':
          case '最近完成的任务':
            // Parse task record
            break;
          case 'recent files':
          case '最近修改的文件':
            state.recentFiles.push(item);
            break;
          case 'blockers':
          case '当前阻塞':
            state.blockers.push(item);
            break;
        }
      }
    }

    return state;
  }

  /**
   * Generate STATE.md content
   */
  private generateStateMd(context: SessionContext): string {
    const lines: string[] = [
      `# Session State`,
      ``,
      `**Session ID**: ${context.sessionId}`,
      `**User**: ${context.userId}`,
      `**Default Agent**: ${context.defaultAgent}`,
      `**Working Directory**: ${context.workingDir}`,
      `**Last Activity**: ${context.lastActivity.toISOString()}`,
      ``,
    ];

    if (context.state.completedTasks.length > 0) {
      lines.push(`## Completed Tasks`);
      for (const task of context.state.completedTasks.slice(-10)) {
        const icon = task.success ? '✅' : '❌';
        lines.push(`- ${icon} ${task.task}`);
      }
      lines.push('');
    }

    if (context.state.recentFiles.length > 0) {
      lines.push(`## Recent Files`);
      for (const file of context.state.recentFiles.slice(0, 10)) {
        lines.push(`- ${file}`);
      }
      lines.push('');
    }

    if (context.state.decisions.length > 0) {
      lines.push(`## Decisions`);
      for (const d of context.state.decisions.slice(-10)) {
        lines.push(`- ${d.decision}`);
      }
      lines.push('');
    }

    if (context.state.blockers.length > 0) {
      lines.push(`## Blockers`);
      for (const b of context.state.blockers) {
        lines.push(`- ${b}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

export const contextManager = new ContextManager();
export default contextManager;
