import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalRequest,
  ContextState,
  Decision,
  PendingTaskExecution,
  PendingTaskStatus,
  PermissionDecision,
  PermissionRequest,
  SessionContext,
  TaskRecord,
} from '../types';
import {
  DEFAULT_PERMISSION_TIMEOUT_SECONDS,
  DEFAULT_PERMISSION_MODE,
  isValidPermissionActionCategory,
  normalizePermissionMode,
} from '../permissions/contract';
import storage from '../utils/storage';
import logger from '../utils/logger';

export interface ResolveApprovalRequestResult {
  status: 'resolved' | 'not_found' | 'ambiguous';
  approval?: ApprovalRequest;
  matches?: ApprovalRequest[];
}

function createDefaultState(): ContextState {
  return {
    completedTasks: [],
    pendingItems: [],
    decisions: [],
    blockers: [],
    recentFiles: [],
    approvalRequests: [],
    pendingExecutions: [],
  };
}

function parseDate(value: unknown, fallback: Date = new Date()): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

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
    const defaultPermissionMode = defaults.permissionMode || DEFAULT_PERMISSION_MODE;

    // Try to load existing session
    const existingSession = await storage.getSession(userId);
    
    if (existingSession) {
      const state = existingSession.state
        ? this.normalizeState(existingSession.state)
        : await this.loadStateFromMarkdown(userId);

      // Load context summary
      const summary = await storage.getStateFile(userId, 'CONTEXT.md') || '';

      const context: SessionContext = {
        userId,
        sessionId: existingSession.sessionId as string,
        defaultAgent: existingSession.defaultAgent as string || defaults.defaultAgent || 'iflow',
        workingDir: existingSession.workingDir as string || defaults.workingDir || process.cwd(),
        projectName: existingSession.projectName as string,
        summary,
        state,
        lastActivity: new Date(existingSession.lastActivity as string || Date.now()),
        permissionMode: normalizePermissionMode(
          existingSession.permissionMode,
          defaultPermissionMode
        ),
      };

      if (this.expireOverdueApprovalState(context.state)) {
        context.lastActivity = new Date();
        await this.save(context);
      }

      return context;
    }

    // Create new session
    const newSession: SessionContext = {
      userId,
      sessionId: uuidv4(),
      defaultAgent: defaults.defaultAgent || 'iflow',
      workingDir: defaults.workingDir || process.cwd(),
      summary: '',
      state: createDefaultState(),
      lastActivity: new Date(),
      permissionMode: defaultPermissionMode,
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
      lastActivity: context.lastActivity.toISOString(),
      permissionMode: context.permissionMode,
      state: this.serializeState(context.state),
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

  async listPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
    const context = await this.load(userId);
    return context.state.approvalRequests
      .filter(request => request.status === 'pending')
      .sort((left, right) => right.requestedAt.getTime() - left.requestedAt.getTime());
  }

  async createApprovalRequest(
    userId: string,
    request: PermissionRequest
  ): Promise<ApprovalRequest> {
    const context = await this.load(userId);
    const requestedAt = new Date();
    const timeout =
      request.timeout > 0 ? request.timeout : DEFAULT_PERMISSION_TIMEOUT_SECONDS;
    const approval: ApprovalRequest = {
      id: request.id || uuidv4(),
      tool: request.tool,
      action: request.action,
      category:
        request.category && isValidPermissionActionCategory(request.category)
          ? request.category
          : 'other',
      file: request.file,
      details: request.details,
      timeout,
      status: 'pending',
      requestedAt,
      expiresAt: new Date(requestedAt.getTime() + timeout * 1000),
    };

    context.state.approvalRequests.push(approval);
    context.lastActivity = new Date();
    await this.save(context);

    return approval;
  }

  async createPendingExecution(
    userId: string,
    execution: Omit<PendingTaskExecution, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<PendingTaskExecution> {
    const context = await this.load(userId);
    const now = new Date();
    const pendingExecution: PendingTaskExecution = {
      id: uuidv4(),
      status: 'awaiting_approval',
      createdAt: now,
      updatedAt: now,
      ...execution,
    };

    context.state.pendingExecutions.push(pendingExecution);
    context.lastActivity = now;
    await this.save(context);

    return pendingExecution;
  }

  async listPendingExecutions(userId: string): Promise<PendingTaskExecution[]> {
    const context = await this.load(userId);
    return context.state.pendingExecutions
      .filter(execution =>
        ['awaiting_approval', 'approved', 'running'].includes(execution.status)
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async findPendingExecutionByRequestId(
    userId: string,
    requestId: string
  ): Promise<PendingTaskExecution | null> {
    const context = await this.load(userId);
    return (
      context.state.pendingExecutions.find(
        execution => execution.requestId === requestId
      ) || null
    );
  }

  async updatePendingExecutionStatus(
    userId: string,
    requestId: string,
    status: PendingTaskStatus
  ): Promise<PendingTaskExecution | null> {
    const context = await this.load(userId);
    const execution = context.state.pendingExecutions.find(
      item => item.requestId === requestId
    );

    if (!execution) {
      return null;
    }

    execution.status = status;
    execution.updatedAt = new Date();
    context.lastActivity = new Date();
    await this.save(context);

    return execution;
  }

  async resolveApprovalRequest(
    userId: string,
    decision: Exclude<PermissionDecision, 'pending'>,
    requestId?: string
  ): Promise<ResolveApprovalRequestResult> {
    const context = await this.load(userId);
    const pendingApprovals = context.state.approvalRequests.filter(
      approval => approval.status === 'pending'
    );

    if (pendingApprovals.length === 0) {
      return { status: 'not_found' };
    }

    const matches = requestId
      ? pendingApprovals.filter(
          approval =>
            approval.id === requestId || approval.id.startsWith(requestId)
        )
      : pendingApprovals;

    if (matches.length === 0) {
      return { status: 'not_found' };
    }

    if (matches.length > 1) {
      return { status: 'ambiguous', matches };
    }

    const approval = matches[0];
    approval.status = decision;
    approval.respondedAt = new Date();
    this.syncPendingExecutionStatus(context.state, approval.id, this.mapDecisionToExecutionStatus(decision));
    context.state.decisions.push({
      decision: `权限请求 ${approval.id.substring(0, 8)} 已${this.describeDecision(decision)}: ${approval.action}`,
      timestamp: new Date(),
    });
    context.lastActivity = new Date();

    await this.save(context);

    return {
      status: 'resolved',
      approval,
    };
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
                       context.state.approvalRequests.length > 0 ||
                       context.state.pendingExecutions.length > 0 ||
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

    const pendingApprovals = context.state.approvalRequests.filter(
      approval => approval.status === 'pending'
    );
    if (pendingApprovals.length > 0) {
      parts.push('## 待审批请求');
      for (const approval of pendingApprovals.slice(0, 5)) {
        parts.push(
          `- [${approval.id.substring(0, 8)}] ${approval.tool}: ${approval.action}`
        );
      }
    }

    const pendingExecutions = context.state.pendingExecutions.filter(
      execution => execution.status === 'awaiting_approval'
    );
    if (pendingExecutions.length > 0) {
      parts.push('## 待恢复任务');
      for (const execution of pendingExecutions.slice(0, 5)) {
        parts.push(
          `- [${execution.requestId.substring(0, 8)}] ${execution.agentName}: ${execution.task.substring(0, 100)}`
        );
      }
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
    const state = createDefaultState();

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

  private async loadStateFromMarkdown(userId: string): Promise<ContextState> {
    const stateContent = await storage.getStateFile(userId, 'STATE.md');
    return stateContent ? this.parseStateMd(stateContent) : createDefaultState();
  }

  private normalizeState(rawState: unknown): ContextState {
    if (!rawState || typeof rawState !== 'object') {
      return createDefaultState();
    }

    const state = rawState as Record<string, unknown>;

    return {
      currentTask:
        typeof state.currentTask === 'string' ? state.currentTask : undefined,
      completedTasks: Array.isArray(state.completedTasks)
        ? state.completedTasks
            .map(item => this.normalizeTaskRecord(item))
            .filter((item): item is TaskRecord => Boolean(item))
        : [],
      pendingItems: Array.isArray(state.pendingItems)
        ? state.pendingItems.filter((item): item is string => typeof item === 'string')
        : [],
      decisions: Array.isArray(state.decisions)
        ? state.decisions
            .map(item => this.normalizeDecision(item))
            .filter((item): item is Decision => Boolean(item))
        : [],
      blockers: Array.isArray(state.blockers)
        ? state.blockers.filter((item): item is string => typeof item === 'string')
        : [],
      recentFiles: Array.isArray(state.recentFiles)
        ? state.recentFiles.filter((item): item is string => typeof item === 'string')
        : [],
      approvalRequests: Array.isArray(state.approvalRequests)
        ? state.approvalRequests
            .map(item => this.normalizeApprovalRequest(item))
            .filter((item): item is ApprovalRequest => Boolean(item))
        : [],
      pendingExecutions: Array.isArray(state.pendingExecutions)
        ? state.pendingExecutions
            .map(item => this.normalizePendingExecution(item))
            .filter((item): item is PendingTaskExecution => Boolean(item))
        : [],
    };
  }

  private serializeState(state: ContextState): Record<string, unknown> {
    return {
      ...state,
      completedTasks: state.completedTasks.map(task => ({
        ...task,
        timestamp: task.timestamp.toISOString(),
      })),
      decisions: state.decisions.map(decision => ({
        ...decision,
        timestamp: decision.timestamp.toISOString(),
      })),
      approvalRequests: state.approvalRequests.map(approval => ({
        ...approval,
        requestedAt: approval.requestedAt.toISOString(),
        expiresAt: approval.expiresAt.toISOString(),
        respondedAt: approval.respondedAt?.toISOString(),
      })),
      pendingExecutions: state.pendingExecutions.map(execution => ({
        ...execution,
        createdAt: execution.createdAt.toISOString(),
        updatedAt: execution.updatedAt.toISOString(),
      })),
    };
  }

  private normalizeTaskRecord(rawTask: unknown): TaskRecord | null {
    if (!rawTask || typeof rawTask !== 'object') {
      return null;
    }

    const task = rawTask as Record<string, unknown>;
    if (
      typeof task.task !== 'string' ||
      typeof task.result !== 'string' ||
      typeof task.agent !== 'string'
    ) {
      return null;
    }

    return {
      task: task.task,
      result: task.result,
      agent: task.agent,
      success: task.success !== false,
      timestamp: parseDate(task.timestamp),
    };
  }

  private normalizeDecision(rawDecision: unknown): Decision | null {
    if (!rawDecision || typeof rawDecision !== 'object') {
      return null;
    }

    const decision = rawDecision as Record<string, unknown>;
    if (typeof decision.decision !== 'string') {
      return null;
    }

    return {
      decision: decision.decision,
      rationale:
        typeof decision.rationale === 'string' ? decision.rationale : undefined,
      timestamp: parseDate(decision.timestamp),
    };
  }

  private normalizeApprovalRequest(rawApproval: unknown): ApprovalRequest | null {
    if (!rawApproval || typeof rawApproval !== 'object') {
      return null;
    }

    const approval = rawApproval as Record<string, unknown>;
    if (
      typeof approval.id !== 'string' ||
      typeof approval.tool !== 'string' ||
      typeof approval.action !== 'string' ||
      typeof approval.timeout !== 'number'
    ) {
      return null;
    }

    return {
      id: approval.id,
      tool: approval.tool,
      action: approval.action,
      category:
        typeof approval.category === 'string' &&
        isValidPermissionActionCategory(approval.category)
          ? approval.category
          : 'other',
      file: typeof approval.file === 'string' ? approval.file : undefined,
      details:
        typeof approval.details === 'string' ? approval.details : undefined,
      timeout: approval.timeout,
      status: this.normalizePermissionDecision(approval.status),
      requestedAt: parseDate(approval.requestedAt),
      expiresAt: parseDate(approval.expiresAt),
      respondedAt:
        approval.respondedAt !== undefined
          ? parseDate(approval.respondedAt)
          : undefined,
    };
  }

  private normalizePermissionDecision(value: unknown): PermissionDecision {
    if (
      value === 'pending' ||
      value === 'approved' ||
      value === 'denied' ||
      value === 'expired'
    ) {
      return value;
    }

    return 'pending';
  }

  private normalizePendingExecution(rawExecution: unknown): PendingTaskExecution | null {
    if (!rawExecution || typeof rawExecution !== 'object') {
      return null;
    }

    const execution = rawExecution as Record<string, unknown>;
    if (
      typeof execution.id !== 'string' ||
      typeof execution.requestId !== 'string' ||
      typeof execution.task !== 'string' ||
      typeof execution.agentName !== 'string' ||
      typeof execution.workingDir !== 'string'
    ) {
      return null;
    }

    return {
      id: execution.id,
      requestId: execution.requestId,
      task: execution.task,
      agentName: execution.agentName,
      workingDir: execution.workingDir,
      category:
        typeof execution.category === 'string' &&
        isValidPermissionActionCategory(execution.category)
          ? execution.category
          : 'other',
      status: this.normalizePendingTaskStatus(execution.status),
      createdAt: parseDate(execution.createdAt),
      updatedAt: parseDate(execution.updatedAt),
    };
  }

  private normalizePendingTaskStatus(value: unknown): PendingTaskStatus {
    if (
      value === 'awaiting_approval' ||
      value === 'approved' ||
      value === 'denied' ||
      value === 'expired' ||
      value === 'running' ||
      value === 'completed'
    ) {
      return value;
    }

    return 'awaiting_approval';
  }

  private expireOverdueApprovalState(state: ContextState): boolean {
    let changed = false;
    const now = new Date();

    for (const approval of state.approvalRequests) {
      if (approval.status === 'pending' && approval.expiresAt.getTime() <= now.getTime()) {
        approval.status = 'expired';
        approval.respondedAt = now;
        this.syncPendingExecutionStatus(state, approval.id, 'expired');
        state.decisions.push({
          decision: `权限请求 ${approval.id.substring(0, 8)} 已过期: ${approval.action}`,
          timestamp: now,
        });
        changed = true;
      }
    }

    return changed;
  }

  private syncPendingExecutionStatus(
    state: ContextState,
    requestId: string,
    status: PendingTaskStatus
  ): void {
    const execution = state.pendingExecutions.find(item => item.requestId === requestId);
    if (!execution) {
      return;
    }

    execution.status = status;
    execution.updatedAt = new Date();
  }

  private mapDecisionToExecutionStatus(
    decision: Exclude<PermissionDecision, 'pending'>
  ): PendingTaskStatus {
    switch (decision) {
      case 'approved':
        return 'approved';
      case 'denied':
        return 'denied';
      case 'expired':
        return 'expired';
    }
  }

  private describeDecision(decision: Exclude<PermissionDecision, 'pending'>): string {
    switch (decision) {
      case 'approved':
        return '批准';
      case 'denied':
        return '拒绝';
      case 'expired':
        return '过期';
    }
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

    const pendingApprovals = context.state.approvalRequests.filter(
      approval => approval.status === 'pending'
    );
    if (pendingApprovals.length > 0) {
      lines.push(`## Pending Approvals`);
      for (const approval of pendingApprovals.slice(0, 10)) {
        lines.push(
          `- [${approval.id.substring(0, 8)}] ${approval.tool}: ${approval.action}`
        );
      }
      lines.push('');
    }

    const pendingExecutions = context.state.pendingExecutions.filter(
      execution => execution.status === 'awaiting_approval'
    );
    if (pendingExecutions.length > 0) {
      lines.push(`## Pending Tasks`);
      for (const execution of pendingExecutions.slice(0, 10)) {
        lines.push(
          `- [${execution.requestId.substring(0, 8)}] ${execution.agentName}: ${execution.task}`
        );
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
