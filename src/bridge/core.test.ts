import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Bridge } from './core';
import { ContextManager } from '../context/manager';
import { PRISMMemoryCore } from '../memory';
import { ResearchExecutor } from '../research';
import { WEWRITE_MOCK_MODE_ENV } from '../writing';
import { initStorage, resetStorageForTests } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';
import { BridgeConfig, ExecuteResult, WeChatMessage } from '../types';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-core-test',
  Date.now().toString()
);

function createConfig(mode: BridgeConfig['permission']['mode']): BridgeConfig {
  return {
    defaultAgent: 'codex',
    workingDirectory: '/tmp/project',
    agents: {},
    context: {
      maxHistory: 50,
      summarizeThreshold: 20000,
      stateFile: true,
    },
    permission: {
      mode,
      timeout: 120,
    },
    media: {
      maxImageSizeMB: 10,
      maxFileSizeMB: 25,
    },
    mail: {
      enabled: true,
      provider: 'smtp',
      from: 'bot@example.com',
      replyTo: 'reply@example.com',
      defaultTo: [],
      maxAttachmentSizeMB: 25,
      smtp: {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        user: 'bot@example.com',
        pass: 'secret',
      },
    },
    ilink: {
      pollInterval: 30000,
      timeout: 30000,
    },
  };
}

function createMessage(text: string): WeChatMessage {
  return {
    id: `msg-${Date.now()}`,
    from: 'user-1',
    text,
    type: 'text',
    timestamp: new Date(),
    contextToken: 'ctx-1',
  };
}

describe('Bridge approval flow', () => {
  let manager: ContextManager;

  beforeEach(() => {
    initStorage(TEST_DIR);
    manager = new ContextManager();
  });

  afterEach(async () => {
    delete process.env.WEWRITE_SKILL_PATH;
    delete process.env[WEWRITE_MOCK_MODE_ENV];
    resetStorageForTests();
    resetLoggerForTests();
    jest.restoreAllMocks();
    await fs.remove(TEST_DIR);
  });

  function createBridgeHarness(mode: BridgeConfig['permission']['mode']) {
    const bridge = new Bridge(createConfig(mode), {
      token: 'token',
      accountId: 'account',
      baseUrl: 'https://example.com',
    }) as any;

    const execute = jest.fn<Promise<ExecuteResult>, any[]>(async () => ({
      success: true,
      output: 'done',
      summary: '任务完成',
      filesModified: [],
    }));

    bridge.contextManager = manager;
    bridge.agents = {
      get: jest.fn(() => ({ execute })),
      has: jest.fn(() => true),
      list: jest.fn(() => ['codex']),
      getAvailable: jest.fn(async () => ['codex']),
    };
    bridge.ilink = {
      reply: jest.fn(async () => true),
      sendMarkdown: jest.fn(async () => true),
      requestPermission: jest.fn(async () => true),
      sendLocalMedia: jest.fn(async (_to: string, filePath: string, options?: { mode?: 'image' | 'file' }) => ({
        success: true,
        transportKind: options?.mode || 'file',
        displayName: path.basename(filePath),
        resolvedPath: filePath,
      })),
      stop: jest.fn(),
      poll: jest.fn(),
    };
    bridge.mailSender = {
      send: jest.fn(async () => ({
        success: true,
        accepted: ['user@example.com'],
        rejected: [],
        messageId: 'mail-1',
        summary: '邮件已发送',
      })),
    };
    bridge.memoryCore = new PRISMMemoryCore(manager);
    bridge.researchExecutor = new ResearchExecutor();

    return {
      bridge,
      execute,
      ilink: bridge.ilink,
      mailSender: bridge.mailSender,
    };
  }

  it('should create approval request instead of executing immediately in interactive mode', async () => {
    const { bridge, execute, ilink } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));

    expect(ilink.requestPermission).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.approvalRequests).toHaveLength(1);
    expect(context.state.approvalRequests[0].status).toBe('pending');
    expect(context.state.pendingExecutions).toHaveLength(1);
    expect(context.state.pendingExecutions[0].status).toBe('awaiting_approval');
  });

  it('should resume approved execution', async () => {
    const { bridge, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));
    await bridge.handleMessage(createMessage('/approve'));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      '修改 src/app.ts 的登录逻辑',
      expect.objectContaining({
        workingDir: '/tmp/project',
      })
    );

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.approvalRequests[0].status).toBe('approved');
    expect(context.state.pendingExecutions[0].status).toBe('completed');
  });

  it('should block new tasks while approval is pending', async () => {
    const { bridge, execute, ilink } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));
    await bridge.handleMessage(createMessage('再改一下 src/auth.ts'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('当前有任务待审批')
    );
  });

  it('should expire overdue approvals before approval shortcut is handled', async () => {
    const { bridge, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));
    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    context.state.approvalRequests[0].expiresAt = new Date(Date.now() - 1000);
    context.lastActivity = new Date();
    await manager.save(context);

    await bridge.handleMessage(createMessage('y'));

    expect(execute).not.toHaveBeenCalled();

    const reloaded = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(reloaded.state.approvalRequests[0].status).toBe('expired');
    expect(reloaded.state.pendingExecutions[0].status).toBe('expired');
  });

  it('should not execute tasks in plan mode', async () => {
    const { bridge, execute, ilink } = createBridgeHarness('plan');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('plan 模式')
    );
  });

  it('should pass PRISM memory context to agent execution', async () => {
    const { bridge, execute } = createBridgeHarness('auto');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));

    expect(execute).toHaveBeenCalledWith(
      '修改 src/app.ts 的登录逻辑',
      expect.objectContaining({
        context: expect.stringContaining('# PRISM Memory'),
      })
    );
  });

  it('should resolve and send a local file via /sendfile command', async () => {
    const { bridge, ilink } = createBridgeHarness('interactive');
    const filePath = path.join(TEST_DIR, 'report.txt');
    await fs.writeFile(filePath, 'hello', 'utf8');

    await bridge.handleMessage(createMessage(`/sendfile ${filePath}`));

    expect(ilink.sendLocalMedia).toHaveBeenCalledWith(
      'user-1',
      filePath,
      expect.objectContaining({
        contextToken: 'ctx-1',
        mode: 'file',
      })
    );
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('文件已发送')
    );
  });

  it('should resolve and send a local image via /sendimage command', async () => {
    const { bridge, ilink } = createBridgeHarness('interactive');
    const imagePath = path.join(TEST_DIR, 'photo.png');
    await fs.writeFile(imagePath, 'hello', 'utf8');

    await bridge.handleMessage(createMessage(`/sendimage "${imagePath}"`));

    expect(ilink.sendLocalMedia).toHaveBeenCalledWith(
      'user-1',
      imagePath,
      expect.objectContaining({
        contextToken: 'ctx-1',
        mode: 'image',
      })
    );
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('图片已发送')
    );
  });

  it('should resolve a natural language file-send request without invoking an agent', async () => {
    const { bridge, ilink, execute } = createBridgeHarness('interactive');
    const filePath = path.join(TEST_DIR, 'report.txt');
    await fs.writeFile(filePath, 'hello', 'utf8');

    await bridge.handleMessage(createMessage(`把 "${filePath}" 发给我`));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.sendLocalMedia).toHaveBeenCalledWith(
      'user-1',
      filePath,
      expect.objectContaining({
        contextToken: 'ctx-1',
        mode: 'file',
      })
    );
  });

  it('should ask for clarification on vague natural language media requests', async () => {
    const { bridge, ilink, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('把桌面上的某个文件发给我'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.sendLocalMedia).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('还没说具体文件名')
    );
  });

  it('should classify article workflow requests without invoking an agent', async () => {
    process.env.WEWRITE_SKILL_PATH = path.join(TEST_DIR, 'missing-wewrite-skill');
    const { bridge, execute, ilink } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('写一篇关于 AI 路由的公众号文章'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String)
    );

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.workflowJobs).toHaveLength(1);
    expect(context.state.workflowJobs[0].route).toBe('article_create');
    expect(context.state.workflowJobs[0].lane).toBe('writing');
    expect(context.state.workflowArtifacts.length).toBeGreaterThan(0);
  });

  it('should execute article workflow via codex when WeWrite is available and codex is the only viable writing agent', async () => {
    const skillDir = path.join(TEST_DIR, 'real-wewrite-skill');
    await fs.ensureDir(skillDir);
    process.env.WEWRITE_SKILL_PATH = skillDir;
    const { bridge, execute, ilink } = createBridgeHarness('interactive');
    bridge.agents.getAvailable = jest.fn(async () => ['codex']);
    bridge.agents.get = jest.fn(() => ({ execute }));

    await bridge.handleMessage(createMessage('写一篇关于 AI 路由的公众号文章'));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('WeWrite writing lane workflow'),
      expect.objectContaining({
        workingDir: '/tmp/project',
        writableDirs: [
          expect.stringContaining(
            path.join('sessions', 'user-1', 'artifacts')
          ),
        ],
      })
    );
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('Agent: codex')
    );
  });

  it('should complete article workflows locally when WeWrite mock mode is enabled', async () => {
    process.env[WEWRITE_MOCK_MODE_ENV] = 'true';
    const { bridge, execute, ilink } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('写一篇关于 AI 路由的公众号文章'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('WeWrite mock mode')
    );

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.workflowJobs).toHaveLength(1);
    expect(context.state.workflowJobs[0].status).toBe('completed');
  });

  it('should execute article workflow via claude when WeWrite is available', async () => {
    const skillDir = path.join(TEST_DIR, 'fake-wewrite-skill');
    await fs.ensureDir(skillDir);
    process.env.WEWRITE_SKILL_PATH = skillDir;
    const { bridge, execute, ilink } = createBridgeHarness('interactive');
    const context = await manager.load('user-1', {
      defaultAgent: 'claude',
      workingDir: '/tmp/project',
      permissionMode: 'interactive',
    });
    context.defaultAgent = 'claude';
    context.lastActivity = new Date();
    await manager.save(context);
    bridge.agents.getAvailable = jest.fn(async () => ['claude', 'codex']);
    bridge.agents.get = jest.fn(() => ({ execute }));

    await bridge.handleMessage(createMessage('写一篇关于 AI 路由的公众号文章'));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('WeWrite writing lane workflow'),
      expect.objectContaining({
        workingDir: '/tmp/project',
        writableDirs: [
          expect.stringContaining(
            path.join('sessions', 'user-1', 'artifacts')
          ),
        ],
      })
    );
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('正在调用 WeWrite 工作流')
    );
  });

  it('should ask for clarification on vague article workflow requests', async () => {
    const { bridge, execute, ilink } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('帮我写一篇公众号文章'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('缺少明确主题')
    );

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.workflowJobs).toHaveLength(0);
  });

  it('should create approval-gated research workflow jobs without invoking an agent', async () => {
    const { bridge, execute, ilink } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('开始跑实验，研究小模型路由的上下文效率'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.requestPermission).toHaveBeenCalledTimes(1);

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.approvalRequests).toHaveLength(1);
    expect(context.state.workflowJobs).toHaveLength(1);
    expect(context.state.workflowJobs[0].route).toBe('research_run_request');
    expect(context.state.workflowJobs[0].status).toBe('awaiting_approval');
    expect(context.state.workflowJobs[0].computePool).toBe('research_sandbox');
    expect(
      context.state.workflowArtifacts.some(
        artifact => artifact.kind === 'workflow_governance_report'
      )
    ).toBe(true);
  });

  it('should submit approved research run requests to the configured executor', async () => {
    const queueDir = path.join(TEST_DIR, 'research-queue');
    const { bridge } = createBridgeHarness('interactive');
    bridge.config.research = {
      enabled: true,
      executor: {
        backend: 'local_gpu',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 180,
        allowNetwork: false,
        localGpu: {
          queueDir,
          pythonBin: 'python3',
        },
      },
    };
    bridge.researchExecutor = new ResearchExecutor(bridge.config.research);

    await bridge.handleMessage(createMessage('开始跑实验，研究小模型路由的上下文效率'));
    await bridge.handleMessage(createMessage('/approve'));

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    const workflowJob = context.state.workflowJobs.find(
      job => job.route === 'research_run_request'
    );

    expect(workflowJob?.status).toBe('queued');
    expect(
      context.state.workflowArtifacts.some(
        artifact => artifact.kind === 'research_queue_ticket'
      )
    ).toBe(true);
    expect(workflowJob?.runId).toBeDefined();
    expect((await fs.readdir(queueDir)).filter(name => name.endsWith('.json')).length).toBe(1);
  });

  it('should block networked research runs when sandbox policy forbids network', async () => {
    const { bridge, ilink, execute } = createBridgeHarness('interactive');
    bridge.config.research = {
      enabled: true,
      executor: {
        backend: 'local_gpu',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 180,
        allowNetwork: false,
        localGpu: {
          queueDir: path.join(TEST_DIR, 'network-block-queue'),
          pythonBin: 'python3',
        },
      },
    };

    await bridge.handleMessage(createMessage('开始跑实验并联网抓取网页，研究小模型路由的上下文效率'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.requestPermission).not.toHaveBeenCalled();

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.workflowJobs).toHaveLength(1);
    expect(context.state.workflowJobs[0].status).toBe('clarification_needed');
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('治理门阻断')
    );
  });

  it('should refresh queued research runs during /status', async () => {
    const queueDir = path.join(TEST_DIR, 'status-refresh-queue');
    const statusDir = path.join(queueDir, 'status');
    const { bridge, ilink } = createBridgeHarness('interactive');
    bridge.config.research = {
      enabled: true,
      executor: {
        backend: 'local_gpu',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 180,
        allowNetwork: false,
        localGpu: {
          queueDir,
          statusDir,
          pythonBin: 'python3',
        },
      },
    };
    bridge.researchExecutor = new ResearchExecutor(bridge.config.research);

    await bridge.handleMessage(createMessage('开始跑实验，研究小模型路由的上下文效率'));
    await bridge.handleMessage(createMessage('/approve'));

    const approvedContext = await manager.load('user-1', { permissionMode: 'interactive' });
    const workflowJob = approvedContext.state.workflowJobs.find(
      job => job.route === 'research_run_request'
    );
    await fs.ensureDir(statusDir);
    await fs.writeJson(path.join(statusDir, `${workflowJob!.runId}.json`), {
      status: 'completed',
      message: 'worker done',
    });

    await bridge.handleMessage(createMessage('/status'));

    const refreshed = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(refreshed.state.workflowJobs.find(job => job.id === workflowJob!.id)?.status).toBe('completed');
    expect(ilink.sendMarkdown).toHaveBeenCalled();
  });

  it('should recover failed research runs via /recover', async () => {
    const queueDir = path.join(TEST_DIR, 'recover-queue');
    const statusDir = path.join(queueDir, 'status');
    const recoveryDir = path.join(queueDir, 'recovery');
    const { bridge } = createBridgeHarness('interactive');
    bridge.config.research = {
      enabled: true,
      executor: {
        backend: 'local_gpu',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 180,
        allowNetwork: false,
        localGpu: {
          queueDir,
          statusDir,
          recoveryDir,
          pythonBin: 'python3',
        },
      },
    };
    bridge.researchExecutor = new ResearchExecutor(bridge.config.research);

    await bridge.handleMessage(createMessage('开始跑实验，研究小模型路由的上下文效率'));
    await bridge.handleMessage(createMessage('/approve'));

    const approvedContext = await manager.load('user-1', { permissionMode: 'interactive' });
    const workflowJob = approvedContext.state.workflowJobs.find(
      job => job.route === 'research_run_request'
    )!;
    const originalRunId = workflowJob.runId!;
    await fs.ensureDir(statusDir);
    await fs.writeJson(path.join(statusDir, `${originalRunId}.json`), {
      status: 'failed',
      message: 'worker failed',
    });

    await bridge.handleMessage(createMessage(`/recover ${workflowJob.id.substring(0, 8)}`));

    const recovered = await manager.load('user-1', { permissionMode: 'interactive' });
    const updatedJob = recovered.state.workflowJobs.find(job => job.id === workflowJob.id);
    expect(updatedJob?.status).toBe('queued');
    expect(updatedJob?.runId).not.toBe(originalRunId);
    expect(
      recovered.state.workflowArtifacts.some(
        artifact => artifact.kind === 'research_recovery_ticket'
      )
    ).toBe(true);
    expect((await fs.readdir(queueDir)).some(name => name.endsWith('.json'))).toBe(true);
  });

  it('should execute research proposal workflows via the selected agent', async () => {
    const { bridge, execute, ilink } = createBridgeHarness('interactive');
    bridge.agents.getAvailable = jest.fn(async () => ['codex']);
    bridge.agents.get = jest.fn(() => ({ execute }));

    await bridge.handleMessage(
      createMessage('给我一个关于小模型路由效率的研究计划')
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('research proposal lane'),
      expect.objectContaining({
        workingDir: '/tmp/project',
        writableDirs: [
          expect.stringContaining(
            path.join('sessions', 'user-1', 'artifacts')
          ),
        ],
      })
    );
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('research proposal lane')
    );

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.workflowJobs.some(job => job.route === 'research_plan')).toBe(true);
    expect(
      context.state.workflowArtifacts.some(
        artifact => artifact.kind === 'research_proposal'
      )
    ).toBe(true);
  });

  it('should send a text mail via /mail command', async () => {
    const { bridge, mailSender, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(
      createMessage('/mail user@example.com | Hello | This is a test')
    );

    expect(execute).not.toHaveBeenCalled();
    expect(mailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Hello',
        textBody: 'This is a test',
      })
    );
  });

  it('should resolve a natural language mail request without invoking an agent', async () => {
    const { bridge, mailSender, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(
      createMessage('给 user@example.com 发邮件，主题是 周报，内容是 今天已完成修复')
    );

    expect(execute).not.toHaveBeenCalled();
    expect(mailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '周报',
        textBody: '今天已完成修复',
        recipients: {
          to: [{ address: 'user@example.com' }],
          cc: [],
          bcc: [],
        },
      })
    );
  });

  it('should use default mail recipients for natural language mail requests', async () => {
    const { bridge, mailSender, execute } = createBridgeHarness('interactive');
    bridge.config.mail.defaultTo = ['team@example.com'];

    await bridge.handleMessage(
      createMessage('发邮件，主题是 今日进展，内容是 已完成回归验证')
    );

    expect(execute).not.toHaveBeenCalled();
    expect(mailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '今日进展',
        textBody: '已完成回归验证',
        recipients: {
          to: [{ address: 'team@example.com' }],
          cc: [],
          bcc: [],
        },
      })
    );
  });

  it('should send html mail with a plain-text fallback via /mailhtml command', async () => {
    const { bridge, mailSender } = createBridgeHarness('interactive');

    await bridge.handleMessage(
      createMessage('/mailhtml user@example.com | Hello HTML | <p><b>Hello</b> world</p>')
    );

    expect(mailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Hello HTML',
        htmlBody: '<p><b>Hello</b> world</p>',
        textBody: 'Hello world',
        bodyFormat: 'multipart',
      })
    );
  });

  it('should send an attachment mail via /mailfile command', async () => {
    const { bridge, mailSender } = createBridgeHarness('interactive');
    const filePath = path.join(TEST_DIR, 'report.txt');
    await fs.writeFile(filePath, 'hello', 'utf8');

    await bridge.handleMessage(
      createMessage(`/mailfile user@example.com | Report | ${filePath} | Please review`)
    );

    expect(mailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Report',
        attachments: [
          expect.objectContaining({
            inline: false,
            attachment: expect.objectContaining({
              displayName: 'report.txt',
            }),
          }),
        ],
      })
    );
  });

  it('should surface the resolved path when /mailfile attachment preparation fails', async () => {
    const { bridge, ilink, mailSender } = createBridgeHarness('interactive');
    const expectedResolvedPath = path.resolve('/tmp/project', './missing-file.txt');

    await bridge.handleMessage(
      createMessage('/mailfile user@example.com | Report | ./missing-file.txt | Please review')
    );

    expect(mailSender.send).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining(`解析路径: ${expectedResolvedPath}`)
    );
  });

  it('should reject invalid recipient addresses in /mail command', async () => {
    const { bridge, ilink, mailSender } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('/mail invalid-address | Hi | Body'));

    expect(mailSender.send).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('收件人地址无效')
    );
  });

  it('should ask for clarification when a natural language mail request is incomplete', async () => {
    const { bridge, ilink, mailSender, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(
      createMessage('给 user@example.com 发邮件，主题是 周报')
    );

    expect(execute).not.toHaveBeenCalled();
    expect(mailSender.send).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('信息还不完整')
    );
  });

  it('should surface typed media send failures', async () => {
    const { bridge, ilink } = createBridgeHarness('interactive');
    (ilink.sendLocalMedia as jest.Mock).mockResolvedValueOnce({
      success: false,
      code: 'PROTECTED_PATH',
      message: '禁止发送敏感路径: .ssh',
    });

    await bridge.handleMessage(createMessage('/sendfile ~/.ssh/id_rsa'));

    const replyCalls = (ilink.reply as jest.Mock).mock.calls;
    const lastReply = replyCalls[replyCalls.length - 1];
    expect(lastReply?.[1]).toContain('禁止发送该路径');
  });

  it('should resume already-approved pending task even if current mode was changed to plan', async () => {
    const { bridge, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));
    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    context.permissionMode = 'plan';
    context.lastActivity = new Date();
    await manager.save(context);

    await bridge.handleMessage(createMessage('/approve'));

    expect(execute).toHaveBeenCalledTimes(1);
  });
});
