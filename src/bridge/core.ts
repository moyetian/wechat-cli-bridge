import {
  ILinkClient,
  LocalMediaSendMode,
  LocalMediaSendResult,
} from './ilink-client';
import { AgentFactory, initializeAgents, CLIAdapter } from '../agents';
import { ContextManager } from '../context/manager';
import { parseMessage, generateHelpText } from '../commands/handler';
import { BridgeConfig, WeChatMessage, SessionContext, PermissionMode } from '../types';
import {
  getPermissionModeDescription,
  isValidPermissionMode,
  PERMISSION_MODES,
} from '../permissions/contract';
import {
  blocksExecution,
  inferPermissionCategory,
  requiresApproval,
  summarizeApprovalAction,
} from '../permissions/policy';
import {
  createMailMessageDraft,
  MailMessageDraft,
  normalizeMailChannelConfig,
  parseMailAddressList,
  SMTPMailSender,
} from '../mail';
import { resolveNaturalMediaIntent } from '../media/natural-send';
import { stageLocalMedia } from '../media/staging';
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
  private mailSender: SMTPMailSender;
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
    this.mailSender = new SMTPMailSender(normalizeMailChannelConfig(config.mail));

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
        permissionMode: this.config.permission.mode,
      });

      const approvalShortcut = this.parseApprovalShortcut(message.text);
      if (
        approvalShortcut &&
        context.state.approvalRequests.some(item => item.status === 'pending')
      ) {
        await this.handleApprovalDecision(message, undefined, approvalShortcut);
        return;
      }

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
        await this.ilink.sendMarkdown(
          message.from,
          generateHelpText({
            maxImageSizeMB: this.config.media.maxImageSizeMB,
            maxFileSizeMB: this.config.media.maxFileSizeMB,
          }),
          token
        );
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

      case 'sendfile':
        await this.handleSendFile(message, context, args);
        break;

      case 'sendimage':
        await this.handleSendImage(message, context, args);
        break;

      case 'mail':
        await this.handleMailCommand(message, args, 'text');
        break;

      case 'mailhtml':
        await this.handleMailCommand(message, args, 'html');
        break;

      case 'mailfile':
        await this.handleMailFileCommand(message, context, args);
        break;

      case 'pwd':
      case 'workdir':
        await this.ilink.reply(message, `📁 工作目录: ${context.workingDir}`);
        break;

      case 'permission':
        const mode = args[0]?.toLowerCase();
        if (!mode || !isValidPermissionMode(mode)) {
          await this.ilink.reply(
            message,
            `当前模式: ${context.permissionMode}\n` +
              `可用模式: ${PERMISSION_MODES.join(', ')}`
          );
        } else {
          context.permissionMode = mode as PermissionMode;
          context.lastActivity = new Date();
          await this.contextManager.save(context);
          await this.ilink.reply(
            message,
            `✅ 权限模式已切换: ${mode}\n${getPermissionModeDescription(
              mode as PermissionMode
            )}`
          );
        }
        break;

      case 'pending':
        await this.sendPendingApprovals(message, token);
        break;

      case 'approve':
        await this.handleApprovalDecision(message, args[0], 'approved');
        break;

      case 'deny':
        await this.handleApprovalDecision(message, args[0], 'denied');
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
      const pendingApprovals = await this.contextManager.listPendingApprovals(userId);
      if (pendingApprovals.length === 1) {
        await this.handleApprovalDecision(message, pendingApprovals[0].id, 'denied');
        return;
      }

      if (pendingApprovals.length > 1) {
        const hint = pendingApprovals.map(item => item.id.substring(0, 8)).join(', ');
        await this.ilink.reply(
          message,
          `⚠️ 当前有多个待审批任务，请使用 /deny [requestId]\n可用 ID: ${hint}`
        );
        return;
      }

      await this.ilink.reply(message, '⚠️ 没有正在执行或待审批的任务');
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
    const naturalMediaIntent = await resolveNaturalMediaIntent(task, {
      workingDir: context.workingDir,
    });

    if (naturalMediaIntent) {
      await this.handleNaturalMediaIntent(message, context, naturalMediaIntent);
      return;
    }

    const agentName = targetAgent || context.defaultAgent;
    const agent = this.agents.get(agentName);
    const permissionCategory = inferPermissionCategory(task);

    if (!agent) {
      await this.ilink.reply(message, `❌ Agent 不可用: ${agentName}`);
      return;
    }

    // Check if already running a task
    if (this.activeTasks.has(userId)) {
      await this.ilink.reply(message, '⚠️ 已有任务正在执行，请先发送 /cancel 取消');
      return;
    }

    const pendingApprovals = await this.contextManager.listPendingApprovals(userId);
    if (pendingApprovals.length > 0) {
      await this.ilink.reply(message, '⚠️ 当前有任务待审批，请先处理 /pending');
      return;
    }

    if (blocksExecution(context.permissionMode)) {
      await this.ilink.reply(
        message,
        `📝 当前为 plan 模式，不会执行任务\n分类: ${permissionCategory}\n任务: ${task}`
      );
      return;
    }

    if (requiresApproval(context.permissionMode, permissionCategory)) {
      const approval = await this.contextManager.createApprovalRequest(userId, {
        tool: agentName,
        action: summarizeApprovalAction(task, permissionCategory),
        category: permissionCategory,
        timeout: this.config.permission.timeout,
      });
      await this.contextManager.createPendingExecution(userId, {
        requestId: approval.id,
        task,
        agentName,
        workingDir: context.workingDir,
        category: permissionCategory,
      });
      await this.ilink.requestPermission(
        message.from,
        {
          requestId: approval.id.substring(0, 8),
          tool: agentName,
          action: summarizeApprovalAction(task, permissionCategory),
          category: permissionCategory,
          timeout: approval.timeout,
        },
        message.contextToken
      );
      await this.ilink.reply(
        message,
        `⏸️ 任务已进入待审批\nID: ${approval.id.substring(0, 8)}\n使用 /approve 或 /deny 处理`
      );
      return;
    }

    await this.executeTask(message, {
      context,
      task,
      agentName,
      workingDir: context.workingDir,
      permissionMode: context.permissionMode,
    });
  }

  private async executeTask(
    message: WeChatMessage,
    options: {
      context: SessionContext;
      task: string;
      agentName: string;
      workingDir: string;
      requestId?: string;
      permissionMode: PermissionMode;
    }
  ): Promise<void> {
    const {
      context,
      task,
      agentName,
      workingDir,
      requestId,
      permissionMode,
    } = options;
    const userId = message.from;
    const agent = this.agents.get(agentName);

    if (!agent) {
      await this.ilink.reply(message, `❌ Agent 不可用: ${agentName}`);
      return;
    }

    this.activeTasks.set(userId, {
      agentName,
      startTime: new Date(),
    });

    if (requestId) {
      await this.contextManager.updatePendingExecutionStatus(
        userId,
        requestId,
        'running'
      );
    }

    const contextSummary = await this.contextManager.getSummary(userId);
    await this.ilink.reply(message, `🔄 正在执行 (${agentName})...`);

    try {
      const result = await agent.execute(task, {
        workingDir,
        sessionId: context.sessionId,
        context: contextSummary,
        permissionMode,
        bridgeApproved: Boolean(requestId),
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
      if (requestId) {
        await this.contextManager.updatePendingExecutionStatus(
          userId,
          requestId,
          'completed'
        );
      }

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
      `**待审批请求**: ${context.state.approvalRequests.filter(item => item.status === 'pending').length}`,
      `**待恢复任务**: ${context.state.pendingExecutions.filter(item => item.status === 'awaiting_approval').length}`,
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

  private async sendPendingApprovals(
    message: WeChatMessage,
    contextToken?: string
  ): Promise<void> {
    const pendingApprovals = await this.contextManager.listPendingApprovals(message.from);

    if (pendingApprovals.length === 0) {
      await this.ilink.reply(message, '当前没有待审批请求');
      return;
    }

    const lines = ['# 待审批请求', ''];

    for (const approval of pendingApprovals.slice(0, 10)) {
      lines.push(`- ID: ${approval.id.substring(0, 8)}`);
      lines.push(`  工具: ${approval.tool}`);
      lines.push(`  动作: ${approval.action}`);
      lines.push(`  分类: ${approval.category}`);
      if (approval.file) {
        lines.push(`  文件: ${approval.file}`);
      }
      lines.push(
        `  过期时间: ${approval.expiresAt.toLocaleString('zh-CN', { hour12: false })}`
      );
      lines.push('');
    }

    lines.push('使用 `/approve [requestId]` 或 `/deny [requestId]` 处理请求');
    await this.ilink.sendMarkdown(message.from, lines.join('\n'), contextToken);
  }

  private async handleApprovalDecision(
    message: WeChatMessage,
    requestId: string | undefined,
    decision: 'approved' | 'denied'
  ): Promise<void> {
    const result = await this.contextManager.resolveApprovalRequest(
      message.from,
      decision,
      requestId
    );

    if (result.status === 'not_found') {
      await this.ilink.reply(message, '⚠️ 没有找到待审批请求');
      return;
    }

    if (result.status === 'ambiguous') {
      const matches = result.matches || [];
      const hint = matches.map(item => item.id.substring(0, 8)).join(', ');
      await this.ilink.reply(
        message,
        `⚠️ 存在多个待审批请求，请指定 requestId\n可用 ID: ${hint}`
      );
      return;
    }

    const approval = result.approval!;
    const verb = decision === 'approved' ? '已批准' : '已拒绝';
    await this.ilink.reply(
      message,
      `✅ ${verb}请求 ${approval.id.substring(0, 8)}\n${approval.tool}: ${approval.action}`
    );

    if (decision !== 'approved') {
      return;
    }

    const execution = await this.contextManager.findPendingExecutionByRequestId(
      message.from,
      approval.id
    );
    if (!execution) {
      return;
    }

    const context = await this.contextManager.load(message.from, {
      defaultAgent: this.config.defaultAgent,
      workingDir: this.config.workingDirectory,
      permissionMode: this.config.permission.mode,
    });
    await this.executeTask(message, {
      context,
      task: execution.task,
      agentName: execution.agentName,
      workingDir: execution.workingDir,
      requestId: approval.id,
      permissionMode: context.permissionMode,
    });
  }

  private parseApprovalShortcut(
    text: string
  ): 'approved' | 'denied' | null {
    const normalized = text.trim().toLowerCase();

    if (['y', 'yes', 'approve', '批准'].includes(normalized)) {
      return 'approved';
    }

    if (['n', 'no', 'deny', '拒绝'].includes(normalized)) {
      return 'denied';
    }

    return null;
  }

  private async handleSendFile(
    message: WeChatMessage,
    context: SessionContext,
    args: string[]
  ): Promise<void> {
    await this.handleSendLocalMedia(message, context, args, 'file');
  }

  private async handleSendImage(
    message: WeChatMessage,
    context: SessionContext,
    args: string[]
  ): Promise<void> {
    await this.handleSendLocalMedia(message, context, args, 'image');
  }

  private async handleSendLocalMedia(
    message: WeChatMessage,
    context: SessionContext,
    args: string[],
    mode: LocalMediaSendMode
  ): Promise<void> {
    const command = mode === 'image' ? 'sendimage' : 'sendfile';
    const rawPath = args.join(' ').trim();
    if (!rawPath) {
      await this.ilink.reply(message, `⚠️ 用法: /${command} <path>`);
      return;
    }

    const resolvedPath = path.resolve(context.workingDir, rawPath);
    await this.sendResolvedLocalMedia(message, context, resolvedPath, mode);
  }

  private async handleNaturalMediaIntent(
    message: WeChatMessage,
    context: SessionContext,
    intent: Awaited<ReturnType<typeof resolveNaturalMediaIntent>>
  ): Promise<void> {
    if (!intent) {
      return;
    }

    if (intent.kind !== 'resolved' || !intent.resolvedPath || !intent.mode) {
      await this.ilink.reply(message, intent.message);
      return;
    }

    await this.sendResolvedLocalMedia(
      message,
      context,
      intent.resolvedPath,
      intent.mode
    );
  }

  private async sendResolvedLocalMedia(
    message: WeChatMessage,
    context: SessionContext,
    resolvedPath: string,
    mode: LocalMediaSendMode
  ): Promise<void> {
    const noun = mode === 'image' ? '图片' : '文件';
    const bridgeHome = path.dirname(storage.attachmentsDir);
    const maxSizeBytes =
      (mode === 'image'
        ? this.config.media.maxImageSizeMB
        : this.config.media.maxFileSizeMB) *
      1024 *
      1024;

    await this.ilink.reply(message, `📤 正在发送${noun}: ${resolvedPath}`);
    const result = await this.ilink.sendLocalMedia(message.from, resolvedPath, {
      bridgeHome,
      contextToken: message.contextToken,
      mode,
      maxSizeBytes,
    });

    if (!result.success) {
      await this.ilink.reply(
        message,
        this.formatLocalMediaFailure(noun, resolvedPath, result)
      );
      return;
    }

    await this.contextManager.update(message.from, {
      decision: `发送${noun}到微信: ${result.displayName || resolvedPath}`,
    });
    await this.ilink.reply(
      message,
      `✅ ${noun}已发送: ${result.displayName || resolvedPath}`
    );
  }

  private splitMailParts(input: string): string[] {
    return input
      .split('|')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private buildPlainTextFallbackFromHtml(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async sendMailDraft(
    message: WeChatMessage,
    draft: MailMessageDraft
  ): Promise<void> {
    const result = await this.mailSender.send(draft);

    if (!result.success) {
      await this.ilink.reply(message, `❌ ${result.error || result.summary}`);
      return;
    }

    await this.contextManager.update(message.from, {
      decision: `发送邮件: ${draft.subject}`,
    });
    await this.ilink.reply(
      message,
      `✅ 邮件已发送\n主题: ${draft.subject}\n已投递: ${result.accepted.join(', ')}`
    );
  }

  private async handleMailCommand(
    message: WeChatMessage,
    args: string[],
    mode: 'text' | 'html'
  ): Promise<void> {
    const raw = args.join(' ').trim();
    const parts = this.splitMailParts(raw);
    if (parts.length < 3) {
      await this.ilink.reply(
        message,
        mode === 'text'
          ? '⚠️ 用法: /mail <to> | <subject> | <body>'
          : '⚠️ 用法: /mailhtml <to> | <subject> | <html>'
      );
      return;
    }

    const [toRaw, subject, ...bodyParts] = parts;
    const recipients = parseMailAddressList(toRaw);
    if (recipients.length === 0) {
      await this.ilink.reply(message, `❌ 收件人地址无效: ${toRaw}`);
      return;
    }

    const mailConfig = normalizeMailChannelConfig(this.config.mail);
    if (!mailConfig.from) {
      await this.ilink.reply(message, '❌ 邮件配置缺少发件人 from');
      return;
    }

    const body = bodyParts.join(' | ');
    const draft = createMailMessageDraft({
      from: mailConfig.from,
      replyTo: mailConfig.replyTo,
      recipients: { to: recipients },
      subject,
      ...(mode === 'text'
        ? { textBody: body }
        : {
            textBody: this.buildPlainTextFallbackFromHtml(body) || 'HTML 邮件内容',
            htmlBody: body,
          }),
    });

    await this.sendMailDraft(message, draft);
  }

  private async handleMailFileCommand(
    message: WeChatMessage,
    context: SessionContext,
    args: string[]
  ): Promise<void> {
    const raw = args.join(' ').trim();
    const parts = this.splitMailParts(raw);
    if (parts.length < 3) {
      await this.ilink.reply(
        message,
        '⚠️ 用法: /mailfile <to> | <subject> | <path> | [body]'
      );
      return;
    }

    const [toRaw, subject, attachmentPath, ...bodyParts] = parts;
    const recipients = parseMailAddressList(toRaw);
    if (recipients.length === 0) {
      await this.ilink.reply(message, `❌ 收件人地址无效: ${toRaw}`);
      return;
    }

    const mailConfig = normalizeMailChannelConfig(this.config.mail);
    if (!mailConfig.from) {
      await this.ilink.reply(message, '❌ 邮件配置缺少发件人 from');
      return;
    }

    const resolvedPath = path.resolve(context.workingDir, attachmentPath);
    try {
      const stagedAttachment = await stageLocalMedia(resolvedPath, {
        bridgeHome: path.dirname(storage.attachmentsDir),
        sendIntent: 'mail_attachment',
        transportKind: 'file',
        maxSizeBytes: mailConfig.maxAttachmentSizeMB * 1024 * 1024,
      });
      const draft = createMailMessageDraft({
        from: mailConfig.from,
        replyTo: mailConfig.replyTo,
        recipients: { to: recipients },
        subject,
        textBody: bodyParts.join(' | ') || '请查收附件',
        attachments: [{ attachment: stagedAttachment, inline: false }],
      });

      await this.sendMailDraft(message, draft);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.ilink.reply(
        message,
        `❌ 邮件附件准备失败: ${errorMsg}\n解析路径: ${resolvedPath}`
      );
    }
  }

  private formatLocalMediaFailure(
    noun: string,
    resolvedPath: string,
    result: LocalMediaSendResult
  ): string {
    switch (result.code) {
      case 'NOT_FOUND':
        return `❌ ${noun}不存在: ${resolvedPath}`;
      case 'NOT_FILE':
        return `❌ ${noun}不是普通文件: ${resolvedPath}`;
      case 'PROTECTED_PATH':
        return `❌ 为避免泄露敏感数据，禁止发送该路径: ${resolvedPath}`;
      case 'UNSUPPORTED_IMAGE_TYPE':
        return `❌ 该文件不能按图片发送: ${resolvedPath}\n${result.message || ''}`.trim();
      case 'TOO_LARGE':
        return `❌ ${noun}超过大小限制: ${result.message || resolvedPath}`;
      case 'STAGING_FAILED':
        return `❌ ${noun}准备失败: ${result.message || resolvedPath}`;
      case 'UPLOAD_FAILED':
        return `❌ ${noun}上传失败: ${result.message || resolvedPath}`;
      case 'SEND_FAILED':
      default:
        return `❌ ${noun}发送失败: ${result.message || resolvedPath}`;
    }
  }
}

export default Bridge;
