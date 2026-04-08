import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Bridge } from '../bridge/core';
import { ContextManager } from '../context/manager';
import { PRISMMemoryCore } from '../memory';
import { LocalGpuMockWorker, ResearchExecutor } from '../research';
import { BridgeConfig, WeChatMessage } from '../types';
import { initStorage } from '../utils/storage';
import { resolveBridgeHome } from '../utils/paths';
import { WEWRITE_MOCK_MODE_ENV } from '../writing';

interface TranscriptEntry {
  kind: 'reply' | 'markdown' | 'permission';
  text: string;
}

interface BridgeHarness {
  contextManager: ContextManager;
  memoryCore: PRISMMemoryCore;
  researchExecutor: ResearchExecutor;
  agents: {
    get: (name: string) => {
      execute: () => Promise<{
        success: boolean;
        output: string;
        summary: string;
        filesModified: string[];
      }>;
    };
    has: (name: string) => boolean;
    list: () => string[];
    getAvailable: () => Promise<string[]>;
  };
  ilink: {
    reply: (_message: WeChatMessage, text: string) => Promise<boolean>;
    sendMarkdown: (_to: string, text: string) => Promise<boolean>;
    requestPermission: (
      _to: string,
      request: { action: string }
    ) => Promise<boolean>;
    sendLocalMedia: () => Promise<{
      success: boolean;
      transportKind: 'file';
      displayName: string;
      resolvedPath: string;
    }>;
    stop: () => void;
    poll: () => AsyncGenerator<never[], void, unknown>;
  };
  mailSender: {
    send: () => Promise<{
      success: boolean;
      accepted: string[];
      rejected: string[];
      messageId: string;
      summary: string;
    }>;
  };
  handleMessage(message: WeChatMessage): Promise<void>;
}

export interface LocalM005BridgeUatOptions {
  homeDir?: string;
  workingDir?: string;
  articleRequest?: string;
  researchRequest?: string;
}

export interface LocalM005BridgeUatResult {
  homeDir: string;
  reportPath: string;
  transcriptPath: string;
  articleJobStatus?: string;
  researchJobStatus?: string;
  researchRunId?: string;
}

function createConfig(
  workingDir: string,
  queueDir: string,
  statusDir: string
): BridgeConfig {
  return {
    defaultAgent: 'codex',
    workingDirectory: workingDir,
    agents: {},
    context: {
      maxHistory: 50,
      summarizeThreshold: 20000,
      stateFile: true,
    },
    permission: {
      mode: 'interactive',
      timeout: 120,
    },
    media: {
      maxImageSizeMB: 10,
      maxFileSizeMB: 25,
    },
    mail: {
      enabled: false,
      provider: 'smtp',
      defaultTo: [],
      maxAttachmentSizeMB: 25,
      smtp: {
        host: '',
        port: 465,
        secure: true,
        user: '',
        pass: '',
      },
    },
    research: {
      enabled: true,
      executor: {
        backend: 'local_gpu',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 60,
        allowNetwork: false,
        localGpu: {
          queueDir,
          statusDir,
          pythonBin: 'python3',
        },
      },
    },
    ilink: {
      pollInterval: 30000,
      timeout: 30000,
    },
  };
}

function createMessage(userId: string, text: string): WeChatMessage {
  return {
    id: `uat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    from: userId,
    text,
    type: 'text',
    timestamp: new Date(),
    contextToken: 'uat-ctx',
  };
}

function parseArgs(argv: string[]): LocalM005BridgeUatOptions {
  const parsed: LocalM005BridgeUatOptions = {};

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case '--home':
        parsed.homeDir = next;
        index++;
        break;
      case '--working-dir':
        parsed.workingDir = next;
        index++;
        break;
      case '--article':
        parsed.articleRequest = next;
        index++;
        break;
      case '--research':
        parsed.researchRequest = next;
        index++;
        break;
      default:
        break;
    }
  }

  return parsed;
}

export async function runLocalM005BridgeUat(
  options: LocalM005BridgeUatOptions = {}
): Promise<LocalM005BridgeUatResult> {
  const homeDir = resolveBridgeHome(
    options.homeDir ||
      path.join(os.tmpdir(), `wechat-cli-bridge-m005-bridge-uat-${Date.now()}`)
  );
  const workingDir = path.resolve(options.workingDir || process.cwd());
  const queueDir = path.join(homeDir, 'research-queue');
  const statusDir = path.join(queueDir, 'status');
  const articleRequest =
    options.articleRequest || '写一篇关于 AI 路由的公众号文章';
  const researchRequest =
    options.researchRequest || '开始跑实验，验证 bridge workflow 链路';
  const userId = 'uat-bridge-user';

  initStorage(homeDir);

  const originalMockMode = process.env[WEWRITE_MOCK_MODE_ENV];
  process.env[WEWRITE_MOCK_MODE_ENV] = 'true';

  try {
    const config = createConfig(workingDir, queueDir, statusDir);
    const bridge = new Bridge(config, {
      token: 'token',
      accountId: 'account',
      baseUrl: 'https://example.com',
    }) as unknown as BridgeHarness;
    const manager = new ContextManager();
    const transcript: TranscriptEntry[] = [];

    bridge.contextManager = manager;
    bridge.memoryCore = new PRISMMemoryCore(manager);
    bridge.researchExecutor = new ResearchExecutor(config.research);
    bridge.agents = {
      get: () => ({
        execute: async () => ({
          success: true,
          output: 'done',
          summary: '任务完成',
          filesModified: [],
        }),
      }),
      has: () => true,
      list: () => ['codex'],
      getAvailable: async () => ['codex'],
    };
    bridge.ilink = {
      reply: async (_message: WeChatMessage, text: string) => {
        transcript.push({ kind: 'reply', text });
        return true;
      },
      sendMarkdown: async (_to: string, text: string) => {
        transcript.push({ kind: 'markdown', text });
        return true;
      },
      requestPermission: async (_to: string, request: { action: string }) => {
        transcript.push({
          kind: 'permission',
          text: request.action,
        });
        return true;
      },
      sendLocalMedia: async () => ({
        success: true,
        transportKind: 'file' as const,
        displayName: 'mock',
        resolvedPath: 'mock',
      }),
      stop: () => undefined,
      poll: async function* poll() {
        yield [];
      },
    };
    bridge.mailSender = {
      send: async () => ({
        success: true,
        accepted: [],
        rejected: [],
        messageId: 'mock',
        summary: '邮件已发送',
      }),
    };

    await bridge.handleMessage(createMessage(userId, articleRequest));
    await bridge.handleMessage(createMessage(userId, researchRequest));
    await bridge.handleMessage(createMessage(userId, '/approve'));

    const worker = new LocalGpuMockWorker({
      queueDir,
      statusDir,
      simulateDurationMs: 0,
    });
    await worker.runOnce();

    await bridge.handleMessage(createMessage(userId, '/status'));

    const context = await manager.load(userId, {
      defaultAgent: config.defaultAgent,
      workingDir,
      permissionMode: config.permission.mode,
    });
    const articleJob = context.state.workflowJobs.find(
      job => job.route === 'article_create'
    );
    const researchJob = context.state.workflowJobs.find(
      job => job.route === 'research_run_request'
    );

    const reportDir = path.join(homeDir, 'uat-reports');
    await fs.ensureDir(reportDir);
    const transcriptPath = path.join(reportDir, 'bridge-m005-transcript.json');
    const reportPath = path.join(reportDir, 'bridge-m005-uat.md');
    await fs.writeJson(transcriptPath, transcript, { spaces: 2 });
    await fs.writeFile(
      reportPath,
      [
        '# Bridge M005 Local UAT',
        '',
        `- Home: ${homeDir}`,
        `- Working Directory: ${workingDir}`,
        `- Article Job Status: ${articleJob?.status || '(missing)'}`,
        `- Research Job Status: ${researchJob?.status || '(missing)'}`,
        `- Research Run ID: ${researchJob?.runId || '(missing)'}`,
        `- Transcript: ${transcriptPath}`,
        '',
      ].join('\n'),
      'utf8'
    );

    return {
      homeDir,
      reportPath,
      transcriptPath,
      articleJobStatus: articleJob?.status,
      researchJobStatus: researchJob?.status,
      researchRunId: researchJob?.runId,
    };
  } finally {
    if (originalMockMode === undefined) {
      delete process.env[WEWRITE_MOCK_MODE_ENV];
    } else {
      process.env[WEWRITE_MOCK_MODE_ENV] = originalMockMode;
    }
  }
}

async function main(): Promise<void> {
  const result = await runLocalM005BridgeUat(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nReport: ${result.reportPath}`);
  console.log(`Transcript: ${result.transcriptPath}`);
}

if (require.main === module) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[m005-bridge-uat] failed: ${message}`);
    process.exit(1);
  });
}
