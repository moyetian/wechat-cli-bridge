import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { initStorage, resetStorageForTests } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';
import {
  buildResearchExecutionArtifactDir,
  ResearchExecutor,
} from './executor';
import { LocalGpuMockWorker } from './local-gpu-worker';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-local-gpu-worker-test',
  Date.now().toString()
);

describe('LocalGpuMockWorker', () => {
  beforeEach(() => {
    initStorage(TEST_DIR);
  });

  afterEach(async () => {
    resetStorageForTests();
    resetLoggerForTests();
    jest.restoreAllMocks();
    await fs.remove(TEST_DIR);
  });

  it('should consume queued runs and write completed status payloads', async () => {
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
      userId: 'user-1',
      jobId: 'job-1',
      requestText: '开始跑实验，研究路由效率',
      workingDir: '/tmp/project',
    });

    const worker = new LocalGpuMockWorker({
      queueDir,
      statusDir,
      simulateDurationMs: 0,
    });
    const stats = await worker.runOnce();
    const statusPath = path.join(statusDir, `${submission.runId}.json`);
    const statusPayload = await fs.readJson(statusPath);
    const resultPath = path.join(
      buildResearchExecutionArtifactDir('user-1', 'job-1'),
      `local-gpu-result-${submission.runId}.json`
    );

    expect(stats.processed).toBe(1);
    expect(stats.completed).toBe(1);
    expect(await fs.pathExists(path.join(queueDir, `${submission.runId}.json`))).toBe(false);
    expect(statusPayload.status).toBe('completed');
    expect(statusPayload.resultPath).toBe(resultPath);
    expect(await fs.pathExists(resultPath)).toBe(true);
  });

  it('should write failed status payloads when request text matches fail pattern', async () => {
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
      userId: 'user-2',
      jobId: 'job-2',
      requestText: '开始跑实验，模拟失败',
      workingDir: '/tmp/project',
    });

    const worker = new LocalGpuMockWorker({
      queueDir,
      statusDir,
      simulateDurationMs: 0,
      failPattern: '模拟失败',
    });
    const stats = await worker.runOnce();
    const statusPayload = await fs.readJson(path.join(statusDir, `${submission.runId}.json`));

    expect(stats.processed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(statusPayload.status).toBe('failed');
    expect(statusPayload.message).toContain('模拟失败');
  });
});
