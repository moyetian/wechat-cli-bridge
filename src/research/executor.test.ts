import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { initStorage, resetStorageForTests } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';
import { ResearchExecutor } from './executor';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-research-executor-test',
  Date.now().toString()
);

describe('ResearchExecutor', () => {
  beforeEach(() => {
    initStorage(TEST_DIR);
  });

  afterEach(async () => {
    resetStorageForTests();
    resetLoggerForTests();
    jest.restoreAllMocks();
    await fs.remove(TEST_DIR);
  });

  it('should write a local GPU queue ticket when local backend is enabled', async () => {
    const queueDir = path.join(TEST_DIR, 'queue');
    const executor = new ResearchExecutor({
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
    });

    const result = await executor.submitRun({
      userId: 'user-1',
      jobId: 'job-1',
      requestText: '开始跑实验，研究路由效率',
      workingDir: '/tmp/project',
    });

    expect(result.status).toBe('submitted');
    expect(result.backend).toBe('local_gpu');
    expect(result.message).toContain('local_gpu queue');
    expect(await fs.pathExists(path.join(queueDir, `${result.runId}.json`))).toBe(true);
  });

  it('should report integration missing for remote backend without endpoint', async () => {
    const executor = new ResearchExecutor({
      enabled: true,
      executor: {
        backend: 'remote_http',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 180,
        allowNetwork: true,
      },
    });

    const result = await executor.submitRun({
      userId: 'user-2',
      jobId: 'job-2',
      requestText: '开始跑实验，研究路由效率',
      workingDir: '/tmp/project',
    });

    expect(result.status).toBe('integration_missing');
    expect(result.backend).toBe('remote_http');
  });

  it('should poll local GPU status from worker status files', async () => {
    const queueDir = path.join(TEST_DIR, 'queue');
    const statusDir = path.join(queueDir, 'status');
    const executor = new ResearchExecutor({
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
    });

    const submission = await executor.submitRun({
      userId: 'user-3',
      jobId: 'job-3',
      requestText: '开始跑实验，研究路由效率',
      workingDir: '/tmp/project',
    });
    await fs.ensureDir(statusDir);
    await fs.writeJson(path.join(statusDir, `${submission.runId}.json`), {
      status: 'running',
      message: 'worker 正在执行',
    });

    const polled = await executor.pollRunStatus({
      userId: 'user-3',
      jobId: 'job-3',
      runId: submission.runId!,
    });

    expect(polled.status).toBe('running');
    expect(polled.message).toContain('worker 正在执行');
  });

  it('should requeue failed local GPU runs during recovery', async () => {
    const queueDir = path.join(TEST_DIR, 'queue');
    const statusDir = path.join(queueDir, 'status');
    const recoveryDir = path.join(queueDir, 'recovery');
    const executor = new ResearchExecutor({
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
    });

    const submission = await executor.submitRun({
      userId: 'user-4',
      jobId: 'job-4',
      requestText: '开始跑实验，研究路由效率',
      workingDir: '/tmp/project',
    });
    await fs.ensureDir(statusDir);
    await fs.writeJson(path.join(statusDir, `${submission.runId}.json`), {
      status: 'failed',
      message: 'worker failed',
    });

    const recovery = await executor.recoverRun({
      userId: 'user-4',
      jobId: 'job-4',
      runId: submission.runId!,
    });

    expect(recovery.status).toBe('requeued');
    expect(recovery.runId).toBeDefined();
    expect(await fs.pathExists(path.join(queueDir, `${recovery.runId}.json`))).toBe(true);
    expect(await fs.pathExists(path.join(recoveryDir, `${recovery.runId}.json`))).toBe(true);
  });
});
