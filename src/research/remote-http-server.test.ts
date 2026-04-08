import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { initStorage, resetStorageForTests } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';
import { ResearchExecutor } from './executor';
import { RemoteResearchExecutorServer } from './remote-http-server';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-remote-http-server-test',
  Date.now().toString()
);

describe('RemoteResearchExecutorServer', () => {
  let server: RemoteResearchExecutorServer | undefined;

  beforeEach(() => {
    initStorage(TEST_DIR);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = undefined;
    }
    resetStorageForTests();
    resetLoggerForTests();
    jest.restoreAllMocks();
    await fs.remove(TEST_DIR);
  });

  it('should accept runs over HTTP and expose completed statuses', async () => {
    server = new RemoteResearchExecutorServer({
      storageDir: path.join(TEST_DIR, 'remote-executor'),
      host: '127.0.0.1',
      port: 0,
      pollIntervalMs: 0,
      simulateDurationMs: 0,
    });
    const baseUrl = await server.start();
    const payload = {
      userId: 'user-1',
      runId: 'run-1',
      jobId: 'job-1',
      requestText: '研究路由效果',
      workingDir: '/tmp/project',
      runtimeConfig: {
        enabled: true,
        backend: 'remote_http',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 120,
        allowNetwork: false,
      },
    };

    const submitResponse = await fetch(`${baseUrl}/research-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const submitJson = (await submitResponse.json()) as Record<string, unknown>;

    expect(submitResponse.status).toBe(202);
    expect(submitJson.status).toBe('queued');

    await server.processQueuedRunsOnce();

    const statusResponse = await fetch(`${baseUrl}/research-runs/${payload.runId}`);
    const statusJson = (await statusResponse.json()) as Record<string, unknown>;

    expect(statusResponse.status).toBe(200);
    expect(statusJson.status).toBe('completed');
    expect(statusJson.message).toContain('completed');
    expect(
      await fs.pathExists(
        path.join(TEST_DIR, 'remote-executor', 'results', `${payload.runId}.json`)
      )
    ).toBe(true);
  });

  it('should enforce bearer auth when apiKey is configured', async () => {
    server = new RemoteResearchExecutorServer({
      storageDir: path.join(TEST_DIR, 'secured-remote-executor'),
      host: '127.0.0.1',
      port: 0,
      pollIntervalMs: 0,
      simulateDurationMs: 0,
      apiKey: 'secret-token',
    });
    const baseUrl = await server.start();
    const payload = {
      userId: 'user-2',
      runId: 'run-2',
      jobId: 'job-2',
      requestText: '研究安全门',
      workingDir: '/tmp/project',
      runtimeConfig: {
        enabled: true,
        backend: 'remote_http',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 120,
        allowNetwork: false,
      },
    };

    const unauthorizedResponse = await fetch(`${baseUrl}/research-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    expect(unauthorizedResponse.status).toBe(401);

    const authorizedResponse = await fetch(`${baseUrl}/research-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret-token',
      },
      body: JSON.stringify(payload),
    });
    expect(authorizedResponse.status).toBe(202);
  });

  it('should allow unauthenticated health checks even when apiKey is configured', async () => {
    server = new RemoteResearchExecutorServer({
      storageDir: path.join(TEST_DIR, 'health-remote-executor'),
      host: '127.0.0.1',
      port: 0,
      pollIntervalMs: 0,
      simulateDurationMs: 0,
      apiKey: 'secret-token',
    });
    const baseUrl = await server.start();

    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  it('should support submit, poll and recover through ResearchExecutor', async () => {
    server = new RemoteResearchExecutorServer({
      storageDir: path.join(TEST_DIR, 'recoverable-remote-executor'),
      host: '127.0.0.1',
      port: 0,
      pollIntervalMs: 0,
      simulateDurationMs: 0,
      failPattern: '模拟失败',
    });
    const baseUrl = await server.start();
    const executor = new ResearchExecutor({
      enabled: true,
      executor: {
        backend: 'remote_http',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 120,
        allowNetwork: false,
        remoteHttp: {
          endpoint: baseUrl,
        },
      },
    });

    const submission = await executor.submitRun({
      userId: 'user-3',
      jobId: 'job-3',
      requestText: '研究路由恢复，模拟失败',
      workingDir: '/tmp/project',
    });
    expect(submission.status).toBe('submitted');

    await server.processQueuedRunsOnce();

    const failedStatus = await executor.pollRunStatus({
      userId: 'user-3',
      jobId: 'job-3',
      runId: submission.runId!,
    });
    expect(failedStatus.status).toBe('failed');

    server.setFailPattern('');
    const recovery = await executor.recoverRun({
      userId: 'user-3',
      jobId: 'job-3',
      runId: submission.runId!,
    });
    expect(recovery.status).toBe('resubmitted');
    expect(recovery.runId).toBeDefined();

    await server.processQueuedRunsOnce();

    const recoveredStatus = await executor.pollRunStatus({
      userId: 'user-3',
      jobId: 'job-3',
      runId: recovery.runId!,
    });
    expect(recoveredStatus.status).toBe('completed');
  });
});
