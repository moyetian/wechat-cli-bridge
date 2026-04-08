import fs from 'fs-extra';
import path from 'path';
import {
  buildResearchExecutionArtifactDir,
  normalizeResearchExecutorConfig,
  ResearchExecutorRequestPayload,
  ResearchRunLifecycleStatus,
} from './executor';
import { getBridgePaths } from '../utils/paths';

export interface LocalGpuMockWorkerOptions {
  queueDir: string;
  statusDir: string;
  simulateDurationMs?: number;
  failPattern?: string;
  workerName?: string;
}

export interface LocalGpuMockWorkerRunStats {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
}

interface LocalGpuWorkerStatusPayload {
  runId: string;
  jobId: string;
  userId?: string;
  status: ResearchRunLifecycleStatus;
  message: string;
  worker: string;
  requestPath: string;
  resultPath?: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise(resolve => setTimeout(resolve, ms));
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback;
}

function isResearchExecutorRequestPayload(
  value: unknown
): value is ResearchExecutorRequestPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.userId === 'string' &&
    typeof payload.runId === 'string' &&
    typeof payload.jobId === 'string' &&
    typeof payload.requestText === 'string' &&
    typeof payload.workingDir === 'string' &&
    payload.runtimeConfig !== null &&
    typeof payload.runtimeConfig === 'object'
  );
}

export async function loadLocalGpuMockWorkerOptions(
  explicitHome?: string
): Promise<LocalGpuMockWorkerOptions> {
  const paths = getBridgePaths(explicitHome);
  const config = (await fs.pathExists(paths.configPath))
    ? await fs.readJson(paths.configPath)
    : {};
  const normalized = normalizeResearchExecutorConfig(
    config && typeof config === 'object' ? (config as Record<string, unknown>).research : undefined
  );

  return {
    queueDir: normalized.executor.localGpu.queueDir,
    statusDir: normalized.executor.localGpu.statusDir,
    simulateDurationMs: readPositiveInteger(
      Number.parseInt(process.env.WECHAT_CLI_BRIDGE_MOCK_WORKER_SIMULATE_MS || '', 10),
      250
    ),
    failPattern: process.env.WECHAT_CLI_BRIDGE_MOCK_FAIL_PATTERN || '',
    workerName: 'local-gpu-mock-worker',
  };
}

export class LocalGpuMockWorker {
  private options: Required<LocalGpuMockWorkerOptions>;

  constructor(options: LocalGpuMockWorkerOptions) {
    this.options = {
      queueDir: path.resolve(options.queueDir),
      statusDir: path.resolve(options.statusDir),
      simulateDurationMs: readPositiveInteger(options.simulateDurationMs, 250),
      failPattern: options.failPattern || '',
      workerName: options.workerName || 'local-gpu-mock-worker',
    };
  }

  async runOnce(): Promise<LocalGpuMockWorkerRunStats> {
    await fs.ensureDir(this.options.queueDir);
    await fs.ensureDir(this.options.statusDir);

    const entries = await fs.readdir(this.options.queueDir);
    const ticketPaths = (
      await Promise.all(
        entries
          .filter(name => name.endsWith('.json'))
          .map(async name => {
            const fullPath = path.join(this.options.queueDir, name);
            const stat = await fs.stat(fullPath).catch(() => null);
            if (!stat || !stat.isFile()) {
              return null;
            }

            return {
              path: fullPath,
              mtimeMs: stat.mtimeMs,
            };
          })
      )
    )
      .filter((item): item is { path: string; mtimeMs: number } => Boolean(item))
      .sort((left, right) => left.mtimeMs - right.mtimeMs)
      .map(item => item.path);

    const stats: LocalGpuMockWorkerRunStats = {
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const ticketPath of ticketPaths) {
      const result = await this.processTicket(ticketPath);
      stats.processed += 1;
      if (result === 'completed') {
        stats.completed += 1;
      } else if (result === 'failed') {
        stats.failed += 1;
      } else {
        stats.skipped += 1;
      }
    }

    return stats;
  }

  private async processTicket(
    ticketPath: string
  ): Promise<'completed' | 'failed' | 'skipped'> {
    const processingPath = ticketPath.replace(/\.json$/, '.processing.json');
    try {
      await fs.move(ticketPath, processingPath, { overwrite: false });
    } catch {
      return 'skipped';
    }

    try {
      const payload = await fs.readJson(processingPath).catch(() => null);
      if (!isResearchExecutorRequestPayload(payload)) {
        await fs.remove(processingPath);
        return 'skipped';
      }

      const startedAt = new Date().toISOString();
      await this.writeStatusFile(payload, processingPath, {
        status: 'running',
        message: 'mock worker 正在执行',
        startedAt,
      });

      await sleep(this.options.simulateDurationMs);

      const shouldFail =
        Boolean(this.options.failPattern) &&
        payload.requestText.includes(this.options.failPattern);
      const executionArtifactDir = buildResearchExecutionArtifactDir(
        payload.userId,
        payload.jobId
      );
      const resolvedArtifactDir =
        payload.artifactDir || executionArtifactDir;
      await fs.ensureDir(resolvedArtifactDir);
      const resultPath = path.join(
        resolvedArtifactDir,
        `local-gpu-result-${payload.runId}.json`
      );
      const finishedAt = new Date().toISOString();

      if (shouldFail) {
        await fs.writeJson(
          resultPath,
          {
            runId: payload.runId,
            jobId: payload.jobId,
            userId: payload.userId,
            status: 'failed',
            worker: this.options.workerName,
            requestText: payload.requestText,
            finishedAt,
          },
          { spaces: 2 }
        );
        await this.writeStatusFile(payload, processingPath, {
          status: 'failed',
          message: 'mock worker 按 fail pattern 模拟失败',
          startedAt,
          finishedAt,
          resultPath,
        });
        return 'failed';
      }

      await fs.writeJson(
        resultPath,
        {
          runId: payload.runId,
          jobId: payload.jobId,
          userId: payload.userId,
          status: 'completed',
          worker: this.options.workerName,
          requestText: payload.requestText,
          summary: `Mock local GPU worker completed: ${payload.requestText.slice(0, 120)}`,
          finishedAt,
        },
        { spaces: 2 }
      );
      await this.writeStatusFile(payload, processingPath, {
        status: 'completed',
        message: 'mock worker 已完成执行',
        startedAt,
        finishedAt,
        resultPath,
      });
      return 'completed';
    } finally {
      await fs.remove(processingPath).catch(() => undefined);
    }
  }

  private async writeStatusFile(
    payload: ResearchExecutorRequestPayload,
    requestPath: string,
    status: {
      status: ResearchRunLifecycleStatus;
      message: string;
      startedAt?: string;
      finishedAt?: string;
      resultPath?: string;
    }
  ): Promise<void> {
    const statusPath = path.join(this.options.statusDir, `${payload.runId}.json`);
    const body: LocalGpuWorkerStatusPayload = {
      runId: payload.runId,
      jobId: payload.jobId,
      userId: payload.userId,
      status: status.status,
      message: status.message,
      worker: this.options.workerName,
      requestPath,
      resultPath: status.resultPath,
      updatedAt: new Date().toISOString(),
      startedAt: status.startedAt,
      finishedAt: status.finishedAt,
    };
    await fs.writeJson(statusPath, body, { spaces: 2 });
  }
}

function parseCliArgs(argv: string[]): {
  queueDir?: string;
  statusDir?: string;
  simulateDurationMs?: number;
  failPattern?: string;
  intervalMs: number;
  once: boolean;
  home?: string;
} {
  const parsed: {
    queueDir?: string;
    statusDir?: string;
    simulateDurationMs?: number;
    failPattern?: string;
    intervalMs: number;
    once: boolean;
    home?: string;
  } = {
    intervalMs: 2000,
    once: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case '--once':
        parsed.once = true;
        break;
      case '--queue-dir':
        parsed.queueDir = next;
        index++;
        break;
      case '--status-dir':
        parsed.statusDir = next;
        index++;
        break;
      case '--home':
        parsed.home = next;
        index++;
        break;
      case '--simulate-ms':
        parsed.simulateDurationMs = Number.parseInt(next || '', 10);
        index++;
        break;
      case '--interval-ms':
        parsed.intervalMs = readPositiveInteger(
          Number.parseInt(next || '', 10),
          parsed.intervalMs
        );
        index++;
        break;
      case '--fail-pattern':
        parsed.failPattern = next || '';
        index++;
        break;
      default:
        break;
    }
  }

  return parsed;
}

export async function runLocalGpuMockWorkerCli(argv: string[]): Promise<void> {
  const cli = parseCliArgs(argv);
  const baseOptions = await loadLocalGpuMockWorkerOptions(cli.home);
  const worker = new LocalGpuMockWorker({
    queueDir: cli.queueDir || baseOptions.queueDir,
    statusDir: cli.statusDir || baseOptions.statusDir,
    simulateDurationMs:
      cli.simulateDurationMs !== undefined
        ? cli.simulateDurationMs
        : baseOptions.simulateDurationMs,
    failPattern:
      cli.failPattern !== undefined ? cli.failPattern : baseOptions.failPattern,
    workerName: baseOptions.workerName,
  });

  if (cli.once) {
    const stats = await worker.runOnce();
    console.log(
      `[mock-worker] processed=${stats.processed} completed=${stats.completed} failed=${stats.failed} skipped=${stats.skipped}`
    );
    return;
  }

  console.log(
    `[mock-worker] watching queueDir=${path.resolve(cli.queueDir || baseOptions.queueDir)} statusDir=${path.resolve(cli.statusDir || baseOptions.statusDir)} intervalMs=${cli.intervalMs}`
  );
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const stats = await worker.runOnce();
    if (stats.processed > 0) {
      console.log(
        `[mock-worker] processed=${stats.processed} completed=${stats.completed} failed=${stats.failed} skipped=${stats.skipped}`
      );
    }
    await sleep(cli.intervalMs);
  }
}

if (require.main === module) {
  runLocalGpuMockWorkerCli(process.argv.slice(2)).catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mock-worker] failed: ${message}`);
    process.exit(1);
  });
}
