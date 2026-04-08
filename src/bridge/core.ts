import {
  ILinkClient,
  LocalMediaSendMode,
  LocalMediaSendResult,
} from './ilink-client';
import { AgentFactory, initializeAgents, CLIAdapter } from '../agents';
import { ContextManager } from '../context/manager';
import { parseMessage, generateHelpText } from '../commands/handler';
import {
  BridgeConfig,
  WeChatMessage,
  SessionContext,
  PermissionMode,
  WorkflowLane,
  WorkflowRouteName,
} from '../types';
import {
  assignWorkflowComputePool,
  evaluateWorkflowGovernance,
  formatGovernanceSummary,
  persistWorkflowGovernanceArtifacts,
  ResearchExecutorPolicy,
} from '../governance';
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
  resolveNaturalMailIntent,
  SMTPMailSender,
} from '../mail';
import { resolveNaturalMediaIntent } from '../media/natural-send';
import { stageLocalMedia } from '../media/staging';
import { PRISMMemoryCore } from '../memory';
import { ResearchExecutor, ResearchProposalAdapter } from '../research';
import { RoutingGateway } from '../routing';
import { WeWriteAdapter } from '../writing';
import storage from '../utils/storage';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs-extra';
import { materializeWeChatPreviewHtml } from '../writing/preview';
import {
  buildArticlePreviewPublicUrl,
  publishArticlePreview,
  resolvePreviewPublishConfig,
} from '../writing/publisher';
import { buildArticleImagePlan } from '../writing/image-plan';
import { resolveArticleImageProvider } from '../writing/image-provider';

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
  private routingGateway: RoutingGateway;
  private memoryCore: PRISMMemoryCore;
  private wewriteAdapter: WeWriteAdapter;
  private researchAdapter: ResearchProposalAdapter;
  private researchExecutor: ResearchExecutor;
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
    this.routingGateway = new RoutingGateway();
    this.memoryCore = new PRISMMemoryCore(this.contextManager);
    this.wewriteAdapter = new WeWriteAdapter();
    this.researchAdapter = new ResearchProposalAdapter();
    this.researchExecutor = new ResearchExecutor(this.config.research);

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
        const memoryBundle = await this.memoryCore.loadBundle({
          userId: message.from,
          profile: 'standard',
        });
        await this.ilink.sendMarkdown(
          message.from,
          memoryBundle.rendered || '暂无上下文',
          token
        );
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

      case 'recover':
        await this.handleRecoverWorkflowJob(message, args[0]);
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
    const naturalMailIntent = await resolveNaturalMailIntent(task, {
      defaultRecipients: normalizeMailChannelConfig(this.config.mail).defaultTo,
    });

    if (naturalMailIntent) {
      await this.handleNaturalMailIntent(message, naturalMailIntent);
      return;
    }

    const naturalMediaIntent = await resolveNaturalMediaIntent(task, {
      workingDir: context.workingDir,
    });

    if (naturalMediaIntent) {
      await this.handleNaturalMediaIntent(message, context, naturalMediaIntent);
      return;
    }

    const workflowDecision = await this.routingGateway.routeTask(task);
    if (workflowDecision.kind === 'clarify') {
      await this.ilink.reply(
        message,
        workflowDecision.message || '⚠️ 我需要更多信息才能决定走哪条 workflow。'
      );
      return;
    }

    if (
      workflowDecision.kind === 'workflow' &&
      workflowDecision.route &&
      workflowDecision.route !== 'general_cli_task'
    ) {
      await this.handleWorkflowTask(message, context, task, workflowDecision);
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
      route: 'general_cli_task',
    });
  }

  private async executeTask(
    message: WeChatMessage,
    options: {
      context: SessionContext;
      task: string;
      agentName: string;
      workingDir: string;
      writableDirs?: string[];
      requestId?: string;
      permissionMode: PermissionMode;
      route?: WorkflowRouteName;
      lane?: WorkflowLane;
      workflowJobId?: string;
    }
  ): Promise<void> {
    const {
      context,
      task,
      agentName,
      workingDir,
      writableDirs,
      requestId,
      permissionMode,
      route,
      lane,
      workflowJobId,
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

    if (workflowJobId) {
      await this.contextManager.updateWorkflowJob(userId, workflowJobId, {
        status: 'running',
      });
    }

    if (requestId) {
      await this.contextManager.updatePendingExecutionStatus(
        userId,
        requestId,
        'running'
      );
    }

    const memoryBundle = await this.memoryCore.loadBundle({
      userId,
      task,
      route,
      lane: lane || 'general_cli',
    });
    await this.ilink.reply(message, `🔄 正在执行 (${agentName})...`);
    let workflowJobSettled = false;

    try {
      const result = await agent.execute(task, {
        workingDir,
        writableDirs,
        sessionId: context.sessionId,
        context: memoryBundle.rendered,
        permissionMode,
        bridgeApproved: Boolean(requestId),
      });

      const writingArtifacts =
        result.success &&
        workflowJobId &&
        (route === 'article_create' || route === 'article_edit')
          ? await this.finalizeWritingWorkflowArtifacts(userId, workflowJobId)
          : null;
      const filesModified = [...(result.filesModified || [])];
      if (writingArtifacts?.previewPath && !filesModified.includes(writingArtifacts.previewPath)) {
        filesModified.push(writingArtifacts.previewPath);
      }

      // Update context
      await this.contextManager.update(userId, {
        task,
        result: result.summary,
        agent: agentName,
        success: result.success,
        filesModified,
      });

      if (workflowJobId) {
        await this.contextManager.updateWorkflowJob(userId, workflowJobId, {
          status: result.success ? 'completed' : 'failed',
        });
        workflowJobSettled = true;
      }

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

      if (writingArtifacts?.previewPath) {
        response +=
          `\n\n📖 公众号预览产物:` +
          `\n- 提纲: ${writingArtifacts.outlinePath}` +
          `\n- 草稿: ${writingArtifacts.draftPath}` +
          `\n- 预览 HTML: ${writingArtifacts.previewPath}`;
        if (writingArtifacts.publicPreviewUrl) {
          response += `\n- 预览链接: ${writingArtifacts.publicPreviewUrl}`;
        }
      }
      
      if (!result.success && result.error) {
        response += `\n\n❌ 错误: ${result.error.substring(0, 500)}`;
      }

      if (writingArtifacts?.publicPreviewUrl && result.success) {
        await this.ilink.sendMarkdown(
          message.from,
          [
            `${statusIcon} ${result.summary}`,
            '',
            `- 公众号预览链接: [点击查看](${writingArtifacts.publicPreviewUrl})`,
            `- 备用地址: ${writingArtifacts.publicPreviewUrl}`,
            `- 本地预览文件: ${writingArtifacts.previewPath}`,
          ].join('\n'),
          message.contextToken
        );
      } else {
        await this.ilink.reply(message, response);
      }
    } finally {
      if (workflowJobId && !workflowJobSettled) {
        await this.contextManager.updateWorkflowJob(userId, workflowJobId, {
          status: 'failed',
        });
      }

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

  private async finalizeWritingWorkflowArtifacts(
    userId: string,
    workflowJobId: string
  ): Promise<{
    outlinePath?: string;
    draftPath?: string;
    previewPath?: string;
    publicPreviewUrl?: string;
    imagePlanPath?: string;
    imageAssetsPath?: string;
  } | null> {
    const artifacts = await this.contextManager.listWorkflowArtifacts(userId, workflowJobId);
    const outlineArtifact = artifacts.find(item => item.kind === 'article_outline');
    const draftArtifact = artifacts.find(item => item.kind === 'article_draft');
    const previewArtifact = artifacts.find(item => item.kind === 'article_preview_html');
    const imagePlanArtifact = artifacts.find(item => item.kind === 'article_image_plan');
    const imageAssetsArtifact = artifacts.find(item => item.kind === 'article_image_assets');

    if (!draftArtifact?.path || !previewArtifact?.path) {
      return null;
    }

    if (!(await fs.pathExists(draftArtifact.path))) {
      return null;
    }

    const draftMarkdown = await fs.readFile(draftArtifact.path, 'utf8');
    const imagePlan = buildArticleImagePlan({ draftMarkdown });
    if (imagePlanArtifact?.path) {
      await fs.writeJson(imagePlanArtifact.path, imagePlan, { spaces: 2 });
    }

    const imageProvider = resolveArticleImageProvider();
    const imageResult = await imageProvider.generate(imagePlan, {
      artifactDir: path.dirname(draftArtifact.path),
    });
    if (imageAssetsArtifact?.path) {
      await fs.writeJson(
        imageAssetsArtifact.path,
        {
          status: imageResult.status,
          assets: imageResult.assets.map(asset => ({
            slotId: asset.slotId,
            placement: asset.placement,
            title: asset.title,
            caption: asset.caption,
            alt: asset.alt,
            prompt: asset.prompt,
            path: asset.path,
            targetHeading: asset.targetHeading,
          })),
        },
        { spaces: 2 }
      );
    }

    const publishConfig = resolvePreviewPublishConfig();
    const publicPreviewUrl = publishConfig
      ? buildArticlePreviewPublicUrl(publishConfig.baseUrl, workflowJobId)
      : undefined;
    await materializeWeChatPreviewHtml({
      draftPath: draftArtifact.path,
      previewPath: previewArtifact.path,
      publicUrl: publicPreviewUrl,
      imagePlan,
      imageAssets: imageResult.assets,
    });
    const publishResult = await publishArticlePreview({
      jobId: workflowJobId,
      localPreviewPath: previewArtifact.path,
      config: publishConfig,
    });
    if (publishResult.status === 'published' && publishResult.publicUrl) {
      const existingPublicUrlArtifact = artifacts.find(
        item =>
          item.kind === 'article_preview_url' &&
          item.path === publishResult.publicUrl
      );
      if (!existingPublicUrlArtifact) {
        await this.contextManager.createWorkflowArtifact(userId, {
          jobId: workflowJobId,
          kind: 'article_preview_url',
          label: 'WeChat preview URL',
          summary: '公众号预览公网链接',
          path: publishResult.publicUrl,
        });
      }
    }

    return {
      outlinePath: outlineArtifact?.path,
      draftPath: draftArtifact.path,
      previewPath: previewArtifact.path,
      publicPreviewUrl:
        publishResult.status === 'published' ? publishResult.publicUrl : undefined,
      imagePlanPath: imagePlanArtifact?.path,
      imageAssetsPath: imageAssetsArtifact?.path,
    };
  }

  private getResearchExecutorPolicy(): ResearchExecutorPolicy | undefined {
    if (!this.config.research) {
      return undefined;
    }

    return {
      backend: this.config.research.executor.backend,
      maxBudgetUSD: this.config.research.executor.maxBudgetUSD,
      maxRuntimeMinutes: this.config.research.executor.maxRuntimeMinutes,
      allowNetwork: this.config.research.executor.allowNetwork,
    };
  }

  private async persistGovernanceArtifacts(
    userId: string,
    jobId: string,
    route: WorkflowRouteName,
    lane: WorkflowLane,
    task: string
  ): Promise<string[]> {
    const report = evaluateWorkflowGovernance({
      route,
      lane,
      inputText: task,
      executorPolicy: lane === 'research' ? this.getResearchExecutorPolicy() : undefined,
    });
    const savedArtifactIds: string[] = [];
    const artifacts = await persistWorkflowGovernanceArtifacts({
      userId,
      jobId,
      report,
    });

    for (const artifact of artifacts) {
      const saved = await this.contextManager.createWorkflowArtifact(userId, {
        jobId,
        kind: artifact.kind,
        label: artifact.label,
        summary: artifact.summary,
        path: artifact.path,
      });
      savedArtifactIds.push(saved.id);
    }

    return savedArtifactIds;
  }

  private mapResearchRunStatusToWorkflowStatus(
    status: Awaited<ReturnType<ResearchExecutor['pollRunStatus']>>['status']
  ): 'queued' | 'running' | 'completed' | 'failed' | null {
    switch (status) {
      case 'queued':
        return 'queued';
      case 'running':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return null;
    }
  }

  private async refreshResearchWorkflowStatuses(
    userId: string
  ): Promise<SessionContext> {
    const context = await this.contextManager.load(userId, {
      defaultAgent: this.config.defaultAgent,
      workingDir: this.config.workingDirectory,
      permissionMode: this.config.permission.mode,
    });
    const researchJobs = context.state.workflowJobs.filter(
      job =>
        job.route === 'research_run_request' &&
        ['queued', 'running'].includes(job.status) &&
        Boolean(job.runId)
    );

    if (researchJobs.length === 0) {
      return context;
    }

    let changed = false;
    for (const job of researchJobs) {
      const statusResult = await this.researchExecutor.pollRunStatus({
        userId,
        jobId: job.id,
        runId: job.runId!,
      });
      const mappedStatus = this.mapResearchRunStatusToWorkflowStatus(statusResult.status);
      if (mappedStatus && mappedStatus !== job.status) {
        await this.contextManager.updateWorkflowJob(userId, job.id, {
          status: mappedStatus,
        });
        changed = true;
      }

      const existingArtifacts = await this.contextManager.listWorkflowArtifacts(userId, job.id);
      if (!existingArtifacts.some(item => item.kind === 'research_executor_status')) {
        for (const artifact of statusResult.artifacts) {
          if (artifact.kind !== 'research_executor_status') {
            continue;
          }

          await this.contextManager.createWorkflowArtifact(userId, {
            jobId: job.id,
            kind: artifact.kind,
            label: artifact.label,
            summary: artifact.summary,
            path: artifact.path,
          });
          changed = true;
        }
      }
    }

    if (!changed) {
      return context;
    }

    return this.contextManager.load(userId, {
      defaultAgent: this.config.defaultAgent,
      workingDir: this.config.workingDirectory,
      permissionMode: this.config.permission.mode,
    });
  }

  private async handleWritingWorkflowTask(
    message: WeChatMessage,
    context: SessionContext,
    task: string,
    route: Extract<WorkflowRouteName, 'article_create' | 'article_edit'>
  ): Promise<void> {
    if (this.activeTasks.has(message.from)) {
      await this.ilink.reply(message, '⚠️ 已有任务正在执行，请先发送 /cancel 取消');
      return;
    }

    const pendingApprovals = await this.contextManager.listPendingApprovals(message.from);
    if (pendingApprovals.length > 0) {
      await this.ilink.reply(message, '⚠️ 当前有任务待审批，请先处理 /pending');
      return;
    }

    const availableAgents = await this.agents.getAvailable();
    const summary =
      route === 'article_edit'
        ? '编辑或润色现有文章工作流'
        : '创建新的公众号文章工作流';
    const computePool = assignWorkflowComputePool('writing', route);
    const job = await this.contextManager.createWorkflowJob(message.from, {
      route,
      lane: 'writing',
      inputText: task,
      summary,
      status: 'planned',
      workingDir: context.workingDir,
      computePool,
    });

    const preparation = await this.wewriteAdapter.prepareWorkflow({
      route,
      requestText: task,
      userId: message.from,
      jobId: job.id,
      workingDir: context.workingDir,
      defaultAgent: context.defaultAgent,
      availableAgents,
    });

    const artifactIds = await this.persistGovernanceArtifacts(
      message.from,
      job.id,
      route,
      'writing',
      task
    );
    for (const artifact of preparation.artifacts) {
      const saved = await this.contextManager.createWorkflowArtifact(message.from, {
        jobId: job.id,
        kind: artifact.kind,
        label: artifact.label,
        summary: artifact.summary,
        path: artifact.path,
      });
      artifactIds.push(saved.id);
    }

    await this.contextManager.updateWorkflowJob(message.from, job.id, {
      artifactIds,
      status:
        preparation.status === 'ready'
          ? 'queued'
          : preparation.status === 'completed_local'
            ? 'completed'
            : 'planned',
    });

    if (preparation.status === 'completed_local') {
      await this.ilink.reply(
        message,
        `${preparation.message}\nJob: ${job.id.substring(0, 8)}\nPool: ${computePool}`
      );
      return;
    }

    if (preparation.status !== 'ready' || !preparation.prompt || !preparation.agentName) {
      await this.ilink.reply(
        message,
        `${preparation.message}\nJob: ${job.id.substring(0, 8)}`
      );
      return;
    }

    await this.ilink.reply(
      message,
      `📝 已进入 writing lane\nJob: ${job.id.substring(0, 8)}\nPool: ${computePool}\nAgent: ${preparation.agentName}\n正在调用 WeWrite 工作流...`
    );
    await this.executeTask(message, {
      context,
      task: preparation.prompt,
      agentName: preparation.agentName,
      workingDir: context.workingDir,
      writableDirs: preparation.artifactDir ? [preparation.artifactDir] : undefined,
      permissionMode: context.permissionMode,
      route,
      lane: 'writing',
      workflowJobId: job.id,
    });
  }

  private async handleResearchProposalWorkflowTask(
    message: WeChatMessage,
    context: SessionContext,
    task: string,
    route: Extract<WorkflowRouteName, 'research_idea' | 'research_plan'>
  ): Promise<void> {
    if (this.activeTasks.has(message.from)) {
      await this.ilink.reply(message, '⚠️ 已有任务正在执行，请先发送 /cancel 取消');
      return;
    }

    const pendingApprovals = await this.contextManager.listPendingApprovals(message.from);
    if (pendingApprovals.length > 0) {
      await this.ilink.reply(message, '⚠️ 当前有任务待审批，请先处理 /pending');
      return;
    }

    const availableAgents = await this.agents.getAvailable();
    const summary =
      route === 'research_plan'
        ? '生成研究计划、预算或可行性分析'
        : '生成研究想法或选题';
    const computePool = assignWorkflowComputePool('research', route);
    const job = await this.contextManager.createWorkflowJob(message.from, {
      route,
      lane: 'research',
      inputText: task,
      summary,
      status: 'queued',
      workingDir: context.workingDir,
      computePool,
    });

    const preparation = await this.researchAdapter.prepareWorkflow({
      route,
      requestText: task,
      userId: message.from,
      jobId: job.id,
      workingDir: context.workingDir,
      defaultAgent: context.defaultAgent,
      availableAgents,
    });

    const artifactIds = await this.persistGovernanceArtifacts(
      message.from,
      job.id,
      route,
      'research',
      task
    );
    for (const artifact of preparation.artifacts) {
      const saved = await this.contextManager.createWorkflowArtifact(message.from, {
        jobId: job.id,
        kind: artifact.kind,
        label: artifact.label,
        summary: artifact.summary,
        path: artifact.path,
      });
      artifactIds.push(saved.id);
    }

    await this.contextManager.updateWorkflowJob(message.from, job.id, {
      artifactIds,
      status: 'queued',
    });

    await this.ilink.reply(
      message,
      `🔬 已进入 research proposal lane\nJob: ${job.id.substring(0, 8)}\nPool: ${computePool}\nAgent: ${preparation.agentName}\n正在生成研究计划与预算草稿...`
    );
    await this.executeTask(message, {
      context,
      task: preparation.prompt,
      agentName: preparation.agentName,
      workingDir: context.workingDir,
      writableDirs: [preparation.artifactDir],
      permissionMode: context.permissionMode,
      route,
      lane: 'research',
      workflowJobId: job.id,
    });
  }

  private async handleWorkflowTask(
    message: WeChatMessage,
    context: SessionContext,
    task: string,
    workflowDecision: Awaited<ReturnType<RoutingGateway['routeTask']>>
  ): Promise<void> {
    const userId = message.from;
    const route = workflowDecision.route;
    const lane = workflowDecision.lane || 'bridge';
    const gate = workflowDecision.gate || 'none';

    if (!route) {
      await this.ilink.reply(message, '⚠️ workflow 路由结果不完整');
      return;
    }

    if (route === 'status_query') {
      await this.sendStatus(message.from, context, message.contextToken);
      return;
    }

    if (route === 'article_create' || route === 'article_edit') {
      await this.handleWritingWorkflowTask(message, context, task, route);
      return;
    }

    if (route === 'research_idea' || route === 'research_plan') {
      await this.handleResearchProposalWorkflowTask(message, context, task, route);
      return;
    }

    if (this.activeTasks.has(userId)) {
      await this.ilink.reply(message, '⚠️ 已有任务正在执行，请先发送 /cancel 取消');
      return;
    }

    const pendingApprovals = await this.contextManager.listPendingApprovals(userId);
    if (pendingApprovals.length > 0) {
      await this.ilink.reply(message, '⚠️ 当前有任务待审批，请先处理 /pending');
      return;
    }

    if (gate === 'approval_required') {
      const computePool = assignWorkflowComputePool(lane, route);
      const governanceReport = evaluateWorkflowGovernance({
        route,
        lane,
        inputText: task,
        executorPolicy: lane === 'research' ? this.getResearchExecutorPolicy() : undefined,
      });
      const governanceLines = formatGovernanceSummary(governanceReport);

      if (governanceReport.executionDecision === 'blocked') {
        const job = await this.contextManager.createWorkflowJob(userId, {
          route,
          lane,
          inputText: task,
          summary: workflowDecision.summary,
          rationale: workflowDecision.rationale,
          status: 'clarification_needed',
          workingDir: context.workingDir,
          computePool,
        });
        const artifactIds = await this.persistGovernanceArtifacts(
          userId,
          job.id,
          route,
          lane,
          task
        );
        await this.contextManager.updateWorkflowJob(userId, job.id, {
          artifactIds,
        });
        await this.ilink.reply(
          message,
          `🚫 ${route} workflow 被治理门阻断\nJob: ${job.id.substring(0, 8)}\n${governanceLines.join('\n')}\n原因: ${governanceReport.gates.safety.summary}`
        );
        return;
      }

      const approval = await this.contextManager.createApprovalRequest(userId, {
        tool: `${lane}_lane`,
        action: `${workflowDecision.summary}: ${task}`,
        category: 'execute',
        timeout: this.config.permission.timeout,
        details: `workflow route=${route}; ${governanceLines.join('; ')}`,
      });
      const job = await this.contextManager.createWorkflowJob(userId, {
        route,
        lane,
        inputText: task,
        summary: workflowDecision.summary,
        rationale: workflowDecision.rationale,
        status: 'awaiting_approval',
        workingDir: context.workingDir,
        approvalRequestId: approval.id,
        computePool,
      });
      const artifactIds = await this.persistGovernanceArtifacts(
        userId,
        job.id,
        route,
        lane,
        task
      );
      await this.contextManager.updateWorkflowJob(userId, job.id, {
        artifactIds,
      });

      await this.ilink.requestPermission(
        message.from,
        {
          requestId: approval.id.substring(0, 8),
          tool: approval.tool,
          action: approval.action,
          category: approval.category,
          timeout: approval.timeout,
        },
        message.contextToken
      );
      await this.ilink.reply(
        message,
        `⏸️ 已识别为 ${route} workflow\nJob: ${job.id.substring(0, 8)}\n审批 ID: ${approval.id.substring(0, 8)}\n${governanceLines.join('\n')}\n批准后会提交到 research executor（remote_http 或 local_gpu queue），不会直接在微信会话里同步跑实验。`
      );
      return;
    }

    const status = gate === 'review_required' ? 'planned' : 'planned';
    const computePool = assignWorkflowComputePool(lane, route);
    const job = await this.contextManager.createWorkflowJob(userId, {
      route,
      lane,
      inputText: task,
      summary: workflowDecision.summary,
      rationale: workflowDecision.rationale,
      status,
      workingDir: context.workingDir,
      computePool,
    });
    const artifactIds = await this.persistGovernanceArtifacts(
      userId,
      job.id,
      route,
      lane,
      task
    );
    await this.contextManager.updateWorkflowJob(userId, job.id, {
      artifactIds,
    });

    const laneLabel = lane === 'writing' ? 'writing lane' : 'research lane';
    await this.ilink.reply(
      message,
      `🧭 已识别为 ${route} workflow\nJob: ${job.id.substring(0, 8)}\nLane: ${laneLabel}\nPool: ${computePool}\n当前 M005 S01 只完成语义网关和作业模型，后续会在对应 lane 接入真实执行能力。`
    );
  }

  /**
   * Send status information
   */
  private async sendStatus(to: string, _context: SessionContext, contextToken?: string): Promise<void> {
    const refreshedContext = await this.refreshResearchWorkflowStatuses(to);
    const activeTask = this.activeTasks.get(to);
    const poolCounts = refreshedContext.state.workflowJobs
      .filter(item => !['completed', 'cancelled', 'failed'].includes(item.status))
      .reduce<Record<string, number>>((acc, job) => {
        if (!job.computePool) {
          return acc;
        }

        acc[job.computePool] = (acc[job.computePool] || 0) + 1;
        return acc;
      }, {});
    
    const lines: string[] = [
      '# 当前状态',
      '',
      `**Agent**: ${refreshedContext.defaultAgent}`,
      `**工作目录**: ${refreshedContext.workingDir}`,
      `**权限模式**: ${refreshedContext.permissionMode}`,
      `**会话 ID**: ${refreshedContext.sessionId.substring(0, 8)}...`,
      '',
      `**已完成任务**: ${refreshedContext.state.completedTasks.length}`,
      `**最近修改**: ${refreshedContext.state.recentFiles.length} 个文件`,
      `**待审批请求**: ${refreshedContext.state.approvalRequests.filter(item => item.status === 'pending').length}`,
      `**待恢复任务**: ${refreshedContext.state.pendingExecutions.filter(item => item.status === 'awaiting_approval').length}`,
      `**workflow jobs**: ${refreshedContext.state.workflowJobs.filter(item => !['completed', 'cancelled', 'failed'].includes(item.status)).length}`,
      `**可恢复 failed runs**: ${refreshedContext.state.workflowJobs.filter(item => item.route === 'research_run_request' && item.status === 'failed' && item.runId).length}`,
    ];

    if (activeTask) {
      const duration = Math.round((Date.now() - activeTask.startTime.getTime()) / 1000);
      lines.push('', '**🔄 正在执行任务**', `Agent: ${activeTask.agentName}`, `已运行: ${duration}秒`);
    }

    if (Object.keys(poolCounts).length > 0) {
      lines.push('', '**Compute Pools**:');
      for (const [pool, count] of Object.entries(poolCounts)) {
        lines.push(`- ${pool}: ${count}`);
      }
    }

    if (refreshedContext.state.blockers.length > 0) {
      lines.push('', '**阻塞项**:');
      refreshedContext.state.blockers.forEach(b => lines.push(`- ${b}`));
    }

    const workflowJobs = refreshedContext.state.workflowJobs.filter(item =>
      !['completed', 'cancelled', 'failed'].includes(item.status)
    );
    if (workflowJobs.length > 0) {
      lines.push('', '**Workflow Jobs**:');
      workflowJobs.slice(0, 5).forEach(job => {
        const poolSuffix = job.computePool ? `, ${job.computePool}` : '';
        const runSuffix = job.runId ? `, run=${job.runId}` : '';
        lines.push(`- [${job.id.substring(0, 8)}] ${job.route} (${job.status}${poolSuffix}${runSuffix})`);
      });
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
      const workflowJob = await this.contextManager.findWorkflowJobByApprovalRequestId(
        message.from,
        approval.id
      );
      if (workflowJob && decision === 'approved') {
        await this.handleApprovedWorkflowJob(message, workflowJob);
      }
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

  private async handleApprovedWorkflowJob(
    message: WeChatMessage,
    workflowJob: {
      id: string;
      route: WorkflowRouteName;
      lane: WorkflowLane;
      inputText: string;
      workingDir: string;
      status: string;
      artifactIds: string[];
      computePool?: string;
      runId?: string;
    }
  ): Promise<void> {
    if (workflowJob.route !== 'research_run_request') {
      await this.ilink.reply(
        message,
        `📝 workflow job ${workflowJob.id.substring(0, 8)} 已批准\n当前该 workflow 的实际 lane 执行器仍待接入。`
      );
      return;
    }

    const submission = await this.researchExecutor.submitRun({
      userId: message.from,
      jobId: workflowJob.id,
      requestText: workflowJob.inputText,
      workingDir: workflowJob.workingDir,
    });

    const artifactIds = [...workflowJob.artifactIds];
    for (const artifact of submission.artifacts) {
      const saved = await this.contextManager.createWorkflowArtifact(message.from, {
        jobId: workflowJob.id,
        kind: artifact.kind,
        label: artifact.label,
        summary: artifact.summary,
        path: artifact.path,
      });
      artifactIds.push(saved.id);
    }

    await this.contextManager.updateWorkflowJob(message.from, workflowJob.id, {
      artifactIds,
      runId: submission.runId,
      status:
        submission.status === 'submitted'
          ? 'queued'
          : submission.status === 'failed'
            ? 'failed'
            : 'approved',
    });
    await this.ilink.reply(
      message,
      `${submission.message}\nJob: ${workflowJob.id.substring(0, 8)}\nPool: ${workflowJob.computePool || assignWorkflowComputePool(workflowJob.lane, workflowJob.route)}`
    );
  }

  private async handleRecoverWorkflowJob(
    message: WeChatMessage,
    jobId: string | undefined
  ): Promise<void> {
    const context = await this.refreshResearchWorkflowStatuses(message.from);
    const failedJobs = context.state.workflowJobs.filter(
      job =>
        job.route === 'research_run_request' &&
        job.status === 'failed' &&
        Boolean(job.runId)
    );

    if (failedJobs.length === 0) {
      await this.ilink.reply(message, '当前没有可恢复的 failed research run');
      return;
    }

    const matches = jobId
      ? failedJobs.filter(job => job.id.startsWith(jobId))
      : failedJobs;

    if (matches.length === 0) {
      await this.ilink.reply(message, `⚠️ 没有找到 jobId 以 ${jobId} 开头的 failed research run`);
      return;
    }

    if (matches.length > 1) {
      await this.ilink.reply(
        message,
        `⚠️ 匹配到多个 failed research run，请指定 jobId\n可用 Job: ${matches.map(job => job.id.substring(0, 8)).join(', ')}`
      );
      return;
    }

    const job = matches[0];
    const recovery = await this.researchExecutor.recoverRun({
      userId: message.from,
      jobId: job.id,
      runId: job.runId!,
    });
    const artifactIds = [...job.artifactIds];
    for (const artifact of recovery.artifacts) {
      const saved = await this.contextManager.createWorkflowArtifact(message.from, {
        jobId: job.id,
        kind: artifact.kind,
        label: artifact.label,
        summary: artifact.summary,
        path: artifact.path,
      });
      artifactIds.push(saved.id);
    }

    if (recovery.status === 'requeued' || recovery.status === 'resubmitted') {
      await this.contextManager.updateWorkflowJob(message.from, job.id, {
        artifactIds,
        status: 'queued',
        runId: recovery.runId,
      });
    } else {
      await this.contextManager.updateWorkflowJob(message.from, job.id, {
        artifactIds,
      });
    }

    await this.ilink.reply(
      message,
      `${recovery.message}\nJob: ${job.id.substring(0, 8)}`
    );
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

  private async handleNaturalMailIntent(
    message: WeChatMessage,
    intent: Awaited<ReturnType<typeof resolveNaturalMailIntent>>
  ): Promise<void> {
    if (!intent) {
      return;
    }

    if (
      intent.kind !== 'resolved' ||
      !intent.recipients ||
      !intent.subject ||
      !intent.textBody
    ) {
      await this.ilink.reply(message, intent.message);
      return;
    }

    const mailConfig = normalizeMailChannelConfig(this.config.mail);
    if (!mailConfig.from) {
      await this.ilink.reply(message, '❌ 邮件配置缺少发件人 from');
      return;
    }

    const draft = createMailMessageDraft({
      from: mailConfig.from,
      replyTo: mailConfig.replyTo,
      recipients: { to: intent.recipients },
      subject: intent.subject,
      textBody: intent.textBody,
    });

    await this.sendMailDraft(message, draft);
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
