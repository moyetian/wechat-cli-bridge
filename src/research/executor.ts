import fs from 'fs-extra';
import path from 'path';
import storage from '../utils/storage';
import {
  ResearchArtifactSpec,
} from './contract';

export type ResearchExecutorBackend = 'remote_http' | 'local_gpu';

export interface ResearchExecutorConfig {
  enabled: boolean;
  executor: {
    backend: ResearchExecutorBackend;
    maxBudgetUSD: number;
    maxRuntimeMinutes: number;
    allowNetwork: boolean;
    remoteHttp: {
      endpoint: string;
      apiKey?: string;
    };
    localGpu: {
      queueDir: string;
      statusDir: string;
      recoveryDir: string;
      pythonBin: string;
    };
  };
}

export interface ResearchRunSubmission {
  userId: string;
  jobId: string;
  requestText: string;
  workingDir: string;
}

export interface ResearchExecutorRequestPayload {
  userId: string;
  runId: string;
  jobId: string;
  requestText: string;
  workingDir: string;
  artifactDir?: string;
  runtimeConfig: {
    enabled: boolean;
    backend: ResearchExecutorBackend;
    maxBudgetUSD: number;
    maxRuntimeMinutes: number;
    allowNetwork: boolean;
  };
}

export interface ResearchRunSubmissionResult {
  status: 'submitted' | 'integration_missing' | 'failed';
  backend: ResearchExecutorBackend;
  message: string;
  runId?: string;
  artifacts: ResearchArtifactSpec[];
}

export type ResearchRunLifecycleStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'unknown';

export interface ResearchRunStatusResult {
  status: ResearchRunLifecycleStatus | 'integration_missing';
  backend: ResearchExecutorBackend;
  message: string;
  runId: string;
  artifacts: ResearchArtifactSpec[];
}

export interface ResearchRunRecoveryResult {
  status: 'requeued' | 'resubmitted' | 'skipped' | 'failed';
  backend: ResearchExecutorBackend;
  message: string;
  previousRunId: string;
  runId?: string;
  artifacts: ResearchArtifactSpec[];
}

function readPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export function createDefaultResearchExecutorConfig(): ResearchExecutorConfig {
  const queueDir = path.join(storage.projectsDir, 'research-queue');
  return {
    enabled: false,
    executor: {
      backend: 'remote_http',
      maxBudgetUSD: 30,
      maxRuntimeMinutes: 240,
      allowNetwork: false,
      remoteHttp: {
        endpoint: '',
        apiKey: '',
      },
      localGpu: {
        queueDir,
        statusDir: path.join(queueDir, 'status'),
        recoveryDir: path.join(queueDir, 'recovery'),
        pythonBin: 'python',
      },
    },
  };
}

export function normalizeResearchExecutorConfig(
  raw: unknown
): ResearchExecutorConfig {
  const base = createDefaultResearchExecutorConfig();
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const executorInput =
    input.executor && typeof input.executor === 'object' && !Array.isArray(input.executor)
      ? (input.executor as Record<string, unknown>)
      : {};
  const remoteInput =
    executorInput.remoteHttp &&
    typeof executorInput.remoteHttp === 'object' &&
    !Array.isArray(executorInput.remoteHttp)
      ? (executorInput.remoteHttp as Record<string, unknown>)
      : {};
  const localInput =
    executorInput.localGpu &&
    typeof executorInput.localGpu === 'object' &&
    !Array.isArray(executorInput.localGpu)
      ? (executorInput.localGpu as Record<string, unknown>)
      : {};
  const queueDir =
    typeof localInput.queueDir === 'string' && localInput.queueDir.trim()
      ? path.resolve(localInput.queueDir)
      : base.executor.localGpu.queueDir;

  return {
    enabled: input.enabled === true,
    executor: {
      backend:
        executorInput.backend === 'local_gpu' ? 'local_gpu' : 'remote_http',
      maxBudgetUSD: readPositiveNumber(
        executorInput.maxBudgetUSD,
        base.executor.maxBudgetUSD
      ),
      maxRuntimeMinutes: readPositiveNumber(
        executorInput.maxRuntimeMinutes,
        base.executor.maxRuntimeMinutes
      ),
      allowNetwork: executorInput.allowNetwork === true,
      remoteHttp: {
        endpoint:
          typeof remoteInput.endpoint === 'string'
            ? remoteInput.endpoint.trim()
            : '',
        apiKey:
          typeof remoteInput.apiKey === 'string' ? remoteInput.apiKey : '',
      },
      localGpu: {
        queueDir,
        statusDir:
          typeof localInput.statusDir === 'string' && localInput.statusDir.trim()
            ? path.resolve(localInput.statusDir)
            : path.join(queueDir, 'status'),
        recoveryDir:
          typeof localInput.recoveryDir === 'string' && localInput.recoveryDir.trim()
            ? path.resolve(localInput.recoveryDir)
            : path.join(queueDir, 'recovery'),
        pythonBin:
          typeof localInput.pythonBin === 'string' && localInput.pythonBin.trim()
            ? localInput.pythonBin
            : base.executor.localGpu.pythonBin,
      },
    },
  };
}

function buildRuntimeArtifacts(options: {
  artifactDir: string;
  jobId: string;
  backend: ResearchExecutorBackend;
}): {
  runId: string;
  manifestPath: string;
  runtimeConfigPath: string;
  requestPath: string;
  responsePath: string;
} {
  const runId = `${options.jobId}-${Date.now()}`;
  return {
    runId,
    manifestPath: path.join(options.artifactDir, 'run-manifest.json'),
    runtimeConfigPath: path.join(options.artifactDir, 'runtime-config.json'),
    requestPath: path.join(options.artifactDir, 'executor-request.json'),
    responsePath: path.join(options.artifactDir, 'executor-response.json'),
  };
}

function normalizeLifecycleStatus(value: unknown): ResearchRunLifecycleStatus {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed'
  ) {
    return value;
  }

  return 'unknown';
}

export function buildResearchExecutionArtifactDir(
  userId: string,
  jobId: string
): string {
  return path.join(
    storage.sessionsDir,
    userId,
    'artifacts',
    jobId,
    'execution'
  );
}

export class ResearchExecutor {
  private config: ResearchExecutorConfig;

  constructor(config?: unknown) {
    this.config = normalizeResearchExecutorConfig(config);
  }

  private buildRemoteUrl(runId?: string): string {
    const base = this.config.executor.remoteHttp.endpoint.replace(/\/$/, '');
    return runId ? `${base}/research-runs/${encodeURIComponent(runId)}` : `${base}/research-runs`;
  }

  private getRemoteHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.config.executor.remoteHttp.apiKey
        ? { Authorization: `Bearer ${this.config.executor.remoteHttp.apiKey}` }
        : {}),
    };
  }

  private async writeStatusArtifact(
    artifactDir: string,
    payload: Record<string, unknown>
  ): Promise<ResearchArtifactSpec> {
    const statusPath = path.join(artifactDir, 'executor-status.json');
    await fs.writeJson(statusPath, payload, { spaces: 2 });
    return {
      kind: 'research_executor_status',
      label: 'Executor status',
      path: statusPath,
      summary: '研究执行状态快照',
    };
  }

  async submitRun(
    submission: ResearchRunSubmission
  ): Promise<ResearchRunSubmissionResult> {
    const artifactDir = buildResearchExecutionArtifactDir(
      submission.userId,
      submission.jobId
    );
    await fs.ensureDir(artifactDir);

    const runtime = buildRuntimeArtifacts({
      artifactDir,
      jobId: submission.jobId,
      backend: this.config.executor.backend,
    });

    const runtimeConfig = {
      enabled: this.config.enabled,
      backend: this.config.executor.backend,
      maxBudgetUSD: this.config.executor.maxBudgetUSD,
      maxRuntimeMinutes: this.config.executor.maxRuntimeMinutes,
      allowNetwork: this.config.executor.allowNetwork,
    };
    const requestPayload: ResearchExecutorRequestPayload = {
      userId: submission.userId,
      runId: runtime.runId,
      jobId: submission.jobId,
      requestText: submission.requestText,
      workingDir: submission.workingDir,
      artifactDir,
      runtimeConfig,
    };

    await fs.writeJson(runtime.manifestPath, {
      runId: runtime.runId,
      jobId: submission.jobId,
      backend: this.config.executor.backend,
      createdAt: new Date().toISOString(),
    }, { spaces: 2 });
    await fs.writeJson(runtime.runtimeConfigPath, runtimeConfig, { spaces: 2 });
    await fs.writeJson(runtime.requestPath, requestPayload, { spaces: 2 });

    const artifacts: ResearchArtifactSpec[] = [
      {
        kind: 'research_run_manifest',
        label: 'Run manifest',
        path: runtime.manifestPath,
        summary: `研究执行 manifest (${this.config.executor.backend})`,
      },
      {
        kind: 'research_runtime_config',
        label: 'Runtime config',
        path: runtime.runtimeConfigPath,
        summary: '研究执行 runtime 配置',
      },
      {
        kind: 'research_executor_request',
        label: 'Executor request',
        path: runtime.requestPath,
        summary: '研究执行请求 payload',
      },
    ];

    if (!this.config.enabled) {
      return {
        status: 'integration_missing',
        backend: this.config.executor.backend,
        message: '⚠️ 当前未启用 research executor。已生成运行工单与 runtime artifacts，但尚未提交执行。',
        runId: runtime.runId,
        artifacts,
      };
    }

    if (this.config.executor.backend === 'local_gpu') {
      await fs.ensureDir(this.config.executor.localGpu.queueDir);
      await fs.ensureDir(this.config.executor.localGpu.statusDir);
      await fs.ensureDir(this.config.executor.localGpu.recoveryDir);
      const queuePath = path.join(this.config.executor.localGpu.queueDir, `${runtime.runId}.json`);
      await fs.writeJson(queuePath, requestPayload, { spaces: 2 });
      artifacts.push({
        kind: 'research_queue_ticket',
        label: 'Local GPU queue ticket',
        path: queuePath,
        summary: '已写入 local_gpu queue，待独立 worker 消费',
      });

      return {
        status: 'submitted',
        backend: 'local_gpu',
        message: `✅ 已提交到 local_gpu queue\nRun: ${runtime.runId}`,
        runId: runtime.runId,
        artifacts,
      };
    }

    if (!this.config.executor.remoteHttp.endpoint) {
      return {
        status: 'integration_missing',
        backend: 'remote_http',
        message: '⚠️ 当前未配置 remote research executor endpoint。已生成运行工单与 runtime artifacts，但尚未提交执行。',
        runId: runtime.runId,
        artifacts,
      };
    }

    try {
      const response = await fetch(
        this.buildRemoteUrl(),
        {
          method: 'POST',
          headers: this.getRemoteHeaders(),
          body: JSON.stringify(requestPayload),
        }
      );

      const responseJson = await response.json().catch(() => ({}));
      await fs.writeJson(runtime.responsePath, responseJson, { spaces: 2 });
      artifacts.push({
        kind: 'research_executor_response',
        label: 'Executor response',
        path: runtime.responsePath,
        summary: 'remote executor 返回 payload',
      });

      if (!response.ok) {
        return {
          status: 'failed',
          backend: 'remote_http',
          message: `❌ remote research executor 返回 HTTP ${response.status}`,
          runId: runtime.runId,
          artifacts,
        };
      }

      return {
        status: 'submitted',
        backend: 'remote_http',
        message: `✅ 已提交到 remote research executor\nRun: ${runtime.runId}`,
        runId: runtime.runId,
        artifacts,
      };
    } catch (error) {
      return {
        status: 'failed',
        backend: 'remote_http',
        message: `❌ remote research executor 提交失败: ${error instanceof Error ? error.message : String(error)}`,
        runId: runtime.runId,
        artifacts,
      };
    }
  }

  async pollRunStatus(options: {
    userId: string;
    jobId: string;
    runId: string;
  }): Promise<ResearchRunStatusResult> {
    const artifactDir = buildResearchExecutionArtifactDir(
      options.userId,
      options.jobId
    );
    await fs.ensureDir(artifactDir);
    const artifacts: ResearchArtifactSpec[] = [];

    if (!this.config.enabled) {
      artifacts.push(
        await this.writeStatusArtifact(artifactDir, {
          runId: options.runId,
          backend: this.config.executor.backend,
          status: 'integration_missing',
          observedAt: new Date().toISOString(),
        })
      );
      return {
        status: 'integration_missing',
        backend: this.config.executor.backend,
        message: '⚠️ research executor 未启用，无法轮询运行状态。',
        runId: options.runId,
        artifacts,
      };
    }

    if (this.config.executor.backend === 'local_gpu') {
      const queuePath = path.join(this.config.executor.localGpu.queueDir, `${options.runId}.json`);
      const statusSourcePath = path.join(
        this.config.executor.localGpu.statusDir,
        `${options.runId}.json`
      );
      let status: ResearchRunLifecycleStatus = 'unknown';
      let message = '⚠️ 当前未观察到 local_gpu worker 状态文件。';
      let source = 'missing';

      if (await fs.pathExists(statusSourcePath)) {
        const statusPayload = await fs.readJson(statusSourcePath).catch(() => ({}));
        status = normalizeLifecycleStatus(statusPayload.status);
        message =
          typeof statusPayload.message === 'string'
            ? statusPayload.message
            : `local_gpu worker 状态: ${status}`;
        source = 'worker_status';
      } else if (await fs.pathExists(queuePath)) {
        status = 'queued';
        message = '⏳ 当前 run 仍在 local_gpu queue 中等待 worker 消费。';
        source = 'queue_ticket';
      }

      artifacts.push(
        await this.writeStatusArtifact(artifactDir, {
          runId: options.runId,
          backend: 'local_gpu',
          status,
          source,
          queuePath,
          statusSourcePath,
          observedAt: new Date().toISOString(),
        })
      );

      return {
        status,
        backend: 'local_gpu',
        message,
        runId: options.runId,
        artifacts,
      };
    }

    if (!this.config.executor.remoteHttp.endpoint) {
      artifacts.push(
        await this.writeStatusArtifact(artifactDir, {
          runId: options.runId,
          backend: 'remote_http',
          status: 'integration_missing',
          observedAt: new Date().toISOString(),
        })
      );
      return {
        status: 'integration_missing',
        backend: 'remote_http',
        message: '⚠️ 当前未配置 remote research executor endpoint，无法轮询运行状态。',
        runId: options.runId,
        artifacts,
      };
    }

    try {
      const response = await fetch(this.buildRemoteUrl(options.runId), {
        method: 'GET',
        headers: this.getRemoteHeaders(),
      });
      const responseJson = (await response
        .json()
        .catch(() => ({}))) as Record<string, unknown>;
      const status = response.ok
        ? normalizeLifecycleStatus(responseJson.status)
        : 'unknown';
      const message =
        response.ok && typeof responseJson.message === 'string'
          ? responseJson.message
          : response.ok
            ? `remote executor 状态: ${status}`
            : `⚠️ remote status 查询返回 HTTP ${response.status}`;

      artifacts.push(
        await this.writeStatusArtifact(artifactDir, {
          runId: options.runId,
          backend: 'remote_http',
          status,
          responseStatus: response.status,
          payload: responseJson,
          observedAt: new Date().toISOString(),
        })
      );

      return {
        status,
        backend: 'remote_http',
        message,
        runId: options.runId,
        artifacts,
      };
    } catch (error) {
      artifacts.push(
        await this.writeStatusArtifact(artifactDir, {
          runId: options.runId,
          backend: 'remote_http',
          status: 'unknown',
          error: error instanceof Error ? error.message : String(error),
          observedAt: new Date().toISOString(),
        })
      );
      return {
        status: 'unknown',
        backend: 'remote_http',
        message: `⚠️ remote research executor 状态轮询失败: ${error instanceof Error ? error.message : String(error)}`,
        runId: options.runId,
        artifacts,
      };
    }
  }

  async recoverRun(options: {
    userId: string;
    jobId: string;
    runId: string;
  }): Promise<ResearchRunRecoveryResult> {
    const artifactDir = buildResearchExecutionArtifactDir(
      options.userId,
      options.jobId
    );
    await fs.ensureDir(artifactDir);

    const originalRequestPath = path.join(artifactDir, 'executor-request.json');
    if (!(await fs.pathExists(originalRequestPath))) {
      return {
        status: 'failed',
        backend: this.config.executor.backend,
        message: '❌ 缺少 executor-request.json，无法执行恢复。',
        previousRunId: options.runId,
        artifacts: [],
      };
    }

    const latestStatus = await this.pollRunStatus(options);
    if (latestStatus.status !== 'failed') {
      return {
        status: 'skipped',
        backend: latestStatus.backend,
        message: `当前 run 状态为 ${latestStatus.status}，不执行恢复。`,
        previousRunId: options.runId,
        runId: options.runId,
        artifacts: latestStatus.artifacts,
      };
    }

    const originalRequest = await fs.readJson(originalRequestPath);
    const nextRunId = `${options.jobId}-retry-${Date.now()}`;
    const retryPayload = {
      ...originalRequest,
      runId: nextRunId,
      previousRunId: options.runId,
      retriedAt: new Date().toISOString(),
    };
    const artifacts = [...latestStatus.artifacts];

    if (this.config.executor.backend === 'local_gpu') {
      await fs.ensureDir(this.config.executor.localGpu.queueDir);
      await fs.ensureDir(this.config.executor.localGpu.recoveryDir);
      const queuePath = path.join(this.config.executor.localGpu.queueDir, `${nextRunId}.json`);
      const recoveryPath = path.join(
        this.config.executor.localGpu.recoveryDir,
        `${nextRunId}.json`
      );

      await fs.writeJson(queuePath, retryPayload, { spaces: 2 });
      await fs.writeJson(
        recoveryPath,
        {
          previousRunId: options.runId,
          runId: nextRunId,
          queuePath,
          createdAt: new Date().toISOString(),
        },
        { spaces: 2 }
      );

      artifacts.push(
        {
          kind: 'research_queue_ticket',
          label: 'Recovered local GPU queue ticket',
          path: queuePath,
          summary: '已为失败 run 重新写入 local_gpu queue',
        },
        {
          kind: 'research_recovery_ticket',
          label: 'Recovery ticket',
          path: recoveryPath,
          summary: '记录失败 run 的重提交流程',
        }
      );

      return {
        status: 'requeued',
        backend: 'local_gpu',
        message: `♻️ 已重新写入 local_gpu queue\nOld Run: ${options.runId}\nNew Run: ${nextRunId}`,
        previousRunId: options.runId,
        runId: nextRunId,
        artifacts,
      };
    }

    if (!this.config.executor.remoteHttp.endpoint) {
      return {
        status: 'failed',
        backend: 'remote_http',
        message: '❌ 未配置 remote research executor endpoint，无法重试提交。',
        previousRunId: options.runId,
        artifacts,
      };
    }

    const recoveryRequestPath = path.join(artifactDir, `${nextRunId}-recovery-request.json`);
    const recoveryResponsePath = path.join(artifactDir, `${nextRunId}-recovery-response.json`);
    await fs.writeJson(recoveryRequestPath, retryPayload, { spaces: 2 });
    artifacts.push({
      kind: 'research_recovery_request',
      label: 'Recovery request',
      path: recoveryRequestPath,
      summary: 'remote recovery 重试请求 payload',
    });

    try {
      const response = await fetch(this.buildRemoteUrl(), {
        method: 'POST',
        headers: this.getRemoteHeaders(),
        body: JSON.stringify(retryPayload),
      });
      const responseJson = await response.json().catch(() => ({}));
      await fs.writeJson(recoveryResponsePath, responseJson, { spaces: 2 });
      artifacts.push({
        kind: 'research_recovery_response',
        label: 'Recovery response',
        path: recoveryResponsePath,
        summary: 'remote recovery 返回 payload',
      });

      if (!response.ok) {
        return {
          status: 'failed',
          backend: 'remote_http',
          message: `❌ remote recovery 返回 HTTP ${response.status}`,
          previousRunId: options.runId,
          artifacts,
        };
      }

      return {
        status: 'resubmitted',
        backend: 'remote_http',
        message: `♻️ 已重新提交到 remote research executor\nOld Run: ${options.runId}\nNew Run: ${nextRunId}`,
        previousRunId: options.runId,
        runId: nextRunId,
        artifacts,
      };
    } catch (error) {
      return {
        status: 'failed',
        backend: 'remote_http',
        message: `❌ remote recovery 提交失败: ${error instanceof Error ? error.message : String(error)}`,
        previousRunId: options.runId,
        artifacts,
      };
    }
  }
}
