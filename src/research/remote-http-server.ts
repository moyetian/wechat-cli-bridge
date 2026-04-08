import http from 'http';
import net from 'net';
import fs from 'fs-extra';
import path from 'path';
import {
  ResearchExecutorRequestPayload,
  ResearchRunLifecycleStatus,
} from './executor';

export interface RemoteResearchExecutorServerOptions {
  storageDir: string;
  host?: string;
  port?: number;
  apiKey?: string;
  simulateDurationMs?: number;
  pollIntervalMs?: number;
  failPattern?: string;
  workerName?: string;
}

export interface RemoteResearchExecutorRunStats {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
}

export interface RemoteResearchRunStatusPayload {
  runId: string;
  jobId: string;
  userId?: string;
  previousRunId?: string;
  status: ResearchRunLifecycleStatus;
  message: string;
  worker: string;
  requestPath: string;
  resultPath?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

interface RemoteResearchExecutorStoragePaths {
  rootDir: string;
  queueDir: string;
  requestsDir: string;
  statusDir: string;
  resultsDir: string;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise(resolve => setTimeout(resolve, ms));
}

function isResearchExecutorRequestPayload(
  value: unknown
): value is ResearchExecutorRequestPayload & { previousRunId?: string } {
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

async function readJsonBody(
  request: http.IncomingMessage,
  maxBytes = 1024 * 1024
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new Error(`request body too large (> ${maxBytes} bytes)`);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function writeJson(
  response: http.ServerResponse,
  statusCode: number,
  body: Record<string, unknown>
): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body, null, 2));
}

function normalizeHostForClient(host: string): string {
  if (host === '0.0.0.0' || host === '::') {
    return '127.0.0.1';
  }

  return host;
}

export class RemoteResearchExecutorServer {
  private options: Required<RemoteResearchExecutorServerOptions>;

  private paths: RemoteResearchExecutorStoragePaths;

  private server?: http.Server;

  private pollTimer?: NodeJS.Timeout;

  private processing = false;

  private sockets = new Set<net.Socket>();

  constructor(options: RemoteResearchExecutorServerOptions) {
    this.options = {
      storageDir: path.resolve(options.storageDir),
      host: options.host || '127.0.0.1',
      port: readPositiveInteger(options.port, 8081),
      apiKey: options.apiKey || '',
      simulateDurationMs: readPositiveInteger(options.simulateDurationMs, 1500),
      pollIntervalMs: readPositiveInteger(options.pollIntervalMs, 2000),
      failPattern: options.failPattern || '',
      workerName: options.workerName || 'remote-http-executor',
    };
    this.paths = {
      rootDir: this.options.storageDir,
      queueDir: path.join(this.options.storageDir, 'queue'),
      requestsDir: path.join(this.options.storageDir, 'requests'),
      statusDir: path.join(this.options.storageDir, 'status'),
      resultsDir: path.join(this.options.storageDir, 'results'),
    };
  }

  setFailPattern(failPattern: string): void {
    this.options.failPattern = failPattern;
  }

  async start(): Promise<string> {
    await this.ensureStorageDirs();
    if (this.server) {
      return this.getBaseUrl();
    }

    this.server = http.createServer((request, response) => {
      void this.handleRequest(request, response);
    });
    this.server.on('connection', socket => {
      this.sockets.add(socket);
      socket.on('close', () => {
        this.sockets.delete(socket);
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.options.port, this.options.host, () => {
        this.server!.off('error', reject);
        resolve();
      });
    });

    if (this.options.pollIntervalMs > 0) {
      this.pollTimer = setInterval(() => {
        void this.processQueuedRunsOnce().catch(error => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[remote-executor] process loop failed: ${message}`);
        });
      }, this.options.pollIntervalMs);
      void this.processQueuedRunsOnce().catch(() => undefined);
    }

    return this.getBaseUrl();
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = undefined;
    const closeIdleConnections = (server as http.Server & {
      closeIdleConnections?: () => void;
      closeAllConnections?: () => void;
    }).closeIdleConnections?.bind(server);
    const closeAllConnections = (server as http.Server & {
      closeIdleConnections?: () => void;
      closeAllConnections?: () => void;
    }).closeAllConnections?.bind(server);

    await new Promise<void>((resolve, reject) => {
      const forceCloseTimer = setTimeout(() => {
        closeIdleConnections?.();
        closeAllConnections?.();
        for (const socket of this.sockets) {
          socket.destroy();
        }
      }, 50);

      server.close(error => {
        clearTimeout(forceCloseTimer);
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });

      closeIdleConnections?.();
    });
    this.sockets.clear();
  }

  getBaseUrl(): string {
    const address = this.server?.address();
    if (!address || typeof address === 'string') {
      return `http://${normalizeHostForClient(this.options.host)}:${this.options.port}`;
    }

    return `http://${normalizeHostForClient(this.options.host)}:${address.port}`;
  }

  async processQueuedRunsOnce(): Promise<RemoteResearchExecutorRunStats> {
    if (this.processing) {
      return {
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      };
    }

    this.processing = true;
    try {
      await this.ensureStorageDirs();
      const entries = await fs.readdir(this.paths.queueDir);
      const ticketPaths = (
        await Promise.all(
          entries
            .filter(name => name.endsWith('.json'))
            .map(async name => {
              const fullPath = path.join(this.paths.queueDir, name);
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

      const stats: RemoteResearchExecutorRunStats = {
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
    } finally {
      this.processing = false;
    }
  }

  private async ensureStorageDirs(): Promise<void> {
    await Promise.all([
      fs.ensureDir(this.paths.rootDir),
      fs.ensureDir(this.paths.queueDir),
      fs.ensureDir(this.paths.requestsDir),
      fs.ensureDir(this.paths.statusDir),
      fs.ensureDir(this.paths.resultsDir),
    ]);
  }

  private isAuthorized(request: http.IncomingMessage): boolean {
    if (!this.options.apiKey) {
      return true;
    }

    return request.headers.authorization === `Bearer ${this.options.apiKey}`;
  }

  private async handleRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(
        request.url || '/',
        `http://${request.headers.host || '127.0.0.1'}`
      );

      if (request.method === 'GET' && url.pathname === '/health') {
        writeJson(response, 200, {
          status: 'ok',
          worker: this.options.workerName,
          storageDir: this.paths.rootDir,
        });
        return;
      }

      if (!this.isAuthorized(request)) {
        writeJson(response, 401, {
          error: 'unauthorized',
          message: 'Missing or invalid bearer token.',
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/research-runs') {
        await this.handleCreateRun(request, response);
        return;
      }

      if (request.method === 'GET' && url.pathname.startsWith('/research-runs/')) {
        const runId = decodeURIComponent(url.pathname.replace('/research-runs/', ''));
        await this.handleGetRun(runId, response);
        return;
      }

      writeJson(response, 404, {
        error: 'not_found',
        message: 'Unknown route.',
      });
    } catch (error) {
      writeJson(response, 500, {
        error: 'internal_error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleCreateRun(
    request: http.IncomingMessage,
    response: http.ServerResponse
  ): Promise<void> {
    let payload: unknown;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      writeJson(response, 400, {
        error: 'invalid_json',
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (!isResearchExecutorRequestPayload(payload)) {
      writeJson(response, 400, {
        error: 'invalid_payload',
        message: 'Payload does not match ResearchExecutorRequestPayload.',
      });
      return;
    }

    await this.ensureStorageDirs();
    const requestPath = path.join(this.paths.requestsDir, `${payload.runId}.json`);
    const queuePath = path.join(this.paths.queueDir, `${payload.runId}.json`);
    const statusPath = path.join(this.paths.statusDir, `${payload.runId}.json`);

    const duplicate = await Promise.all([
      fs.pathExists(requestPath),
      fs.pathExists(queuePath),
      fs.pathExists(statusPath),
    ]);
    if (duplicate.some(Boolean)) {
      writeJson(response, 409, {
        error: 'duplicate_run',
        message: `Run ${payload.runId} already exists.`,
        runId: payload.runId,
      });
      return;
    }

    const now = new Date().toISOString();
    await fs.writeJson(requestPath, payload, { spaces: 2 });
    await fs.writeJson(queuePath, payload, { spaces: 2 });
    await this.writeStatusFile(payload, {
      status: 'queued',
      message: 'run accepted by remote executor',
      createdAt: now,
      requestPath,
    });

    if (this.options.pollIntervalMs > 0) {
      void this.processQueuedRunsOnce().catch(() => undefined);
    }

    writeJson(response, 202, {
      runId: payload.runId,
      jobId: payload.jobId,
      status: 'queued',
      message: 'run accepted by remote executor',
    });
  }

  private async handleGetRun(
    runId: string,
    response: http.ServerResponse
  ): Promise<void> {
    if (!runId) {
      writeJson(response, 400, {
        error: 'invalid_run_id',
        message: 'Run ID is required.',
      });
      return;
    }

    const statusPath = path.join(this.paths.statusDir, `${runId}.json`);
    if (!(await fs.pathExists(statusPath))) {
      writeJson(response, 404, {
        error: 'run_not_found',
        message: `Run ${runId} not found.`,
        runId,
      });
      return;
    }

    const status = await fs.readJson(statusPath);
    writeJson(response, 200, status);
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

      const requestPath = path.join(this.paths.requestsDir, `${payload.runId}.json`);
      const existingStatus = await this.readStatusFile(payload.runId);
      const createdAt = existingStatus?.createdAt || new Date().toISOString();
      const startedAt = new Date().toISOString();
      await this.writeStatusFile(payload, {
        status: 'running',
        message: 'remote executor is processing the run',
        requestPath,
        createdAt,
        startedAt,
      });

      await sleep(this.options.simulateDurationMs);

      const shouldFail =
        Boolean(this.options.failPattern) &&
        payload.requestText.includes(this.options.failPattern);
      const resultPath = path.join(this.paths.resultsDir, `${payload.runId}.json`);
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
        await this.writeStatusFile(payload, {
          status: 'failed',
          message: 'remote executor simulated a failure',
          requestPath,
          resultPath,
          createdAt,
          startedAt,
          finishedAt,
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
          summary: `Remote executor completed: ${payload.requestText.slice(0, 120)}`,
          finishedAt,
        },
        { spaces: 2 }
      );
      await this.writeStatusFile(payload, {
        status: 'completed',
        message: 'remote executor completed the run',
        requestPath,
        resultPath,
        createdAt,
        startedAt,
        finishedAt,
      });
      return 'completed';
    } finally {
      await fs.remove(processingPath).catch(() => undefined);
    }
  }

  private async readStatusFile(
    runId: string
  ): Promise<RemoteResearchRunStatusPayload | null> {
    const statusPath = path.join(this.paths.statusDir, `${runId}.json`);
    if (!(await fs.pathExists(statusPath))) {
      return null;
    }

    return fs.readJson(statusPath);
  }

  private async writeStatusFile(
    payload: ResearchExecutorRequestPayload & { previousRunId?: string },
    options: {
      status: ResearchRunLifecycleStatus;
      message: string;
      requestPath: string;
      resultPath?: string;
      createdAt: string;
      startedAt?: string;
      finishedAt?: string;
    }
  ): Promise<void> {
    const statusPath = path.join(this.paths.statusDir, `${payload.runId}.json`);
    const body: RemoteResearchRunStatusPayload = {
      runId: payload.runId,
      jobId: payload.jobId,
      userId: payload.userId,
      previousRunId: payload.previousRunId,
      status: options.status,
      message: options.message,
      worker: this.options.workerName,
      requestPath: options.requestPath,
      resultPath: options.resultPath,
      createdAt: options.createdAt,
      updatedAt: new Date().toISOString(),
      startedAt: options.startedAt,
      finishedAt: options.finishedAt,
    };
    await fs.writeJson(statusPath, body, { spaces: 2 });
  }
}

function parseCliArgs(argv: string[]): {
  host?: string;
  port?: number;
  storageDir?: string;
  apiKey?: string;
  simulateDurationMs?: number;
  pollIntervalMs?: number;
  failPattern?: string;
} {
  const parsed: {
    host?: string;
    port?: number;
    storageDir?: string;
    apiKey?: string;
    simulateDurationMs?: number;
    pollIntervalMs?: number;
    failPattern?: string;
  } = {};

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case '--host':
        parsed.host = next;
        index++;
        break;
      case '--port':
        parsed.port = Number.parseInt(next || '', 10);
        index++;
        break;
      case '--storage-dir':
        parsed.storageDir = next;
        index++;
        break;
      case '--api-key':
        parsed.apiKey = next;
        index++;
        break;
      case '--simulate-ms':
        parsed.simulateDurationMs = Number.parseInt(next || '', 10);
        index++;
        break;
      case '--poll-interval-ms':
        parsed.pollIntervalMs = Number.parseInt(next || '', 10);
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

export async function runRemoteResearchExecutorServerCli(
  argv: string[]
): Promise<void> {
  const cli = parseCliArgs(argv);
  const storageDir =
    cli.storageDir ||
    process.env.WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_STORAGE_DIR ||
    path.resolve(process.cwd(), '.remote-research-executor');
  const host = cli.host || process.env.WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_HOST || '0.0.0.0';
  const port = readPositiveInteger(
    cli.port || Number.parseInt(process.env.WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_PORT || '', 10),
    8081
  );
  const apiKey =
    cli.apiKey || process.env.WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_API_KEY || '';
  const simulateDurationMs = readPositiveInteger(
    cli.simulateDurationMs ||
      Number.parseInt(process.env.WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_SIMULATE_MS || '', 10),
    1500
  );
  const pollIntervalMs = readPositiveInteger(
    cli.pollIntervalMs ||
      Number.parseInt(process.env.WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_POLL_MS || '', 10),
    2000
  );
  const failPattern =
    cli.failPattern || process.env.WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_FAIL_PATTERN || '';

  const server = new RemoteResearchExecutorServer({
    storageDir,
    host,
    port,
    apiKey,
    simulateDurationMs,
    pollIntervalMs,
    failPattern,
  });

  const baseUrl = await server.start();
  console.log(
    `[remote-executor] listening on ${baseUrl} storageDir=${storageDir} pollIntervalMs=${pollIntervalMs}`
  );
  if (apiKey) {
    console.log('[remote-executor] bearer auth enabled');
  }
}

if (require.main === module) {
  runRemoteResearchExecutorServerCli(process.argv.slice(2)).catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[remote-executor] failed: ${message}`);
    process.exit(1);
  });
}
