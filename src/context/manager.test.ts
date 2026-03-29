import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { ContextManager } from './manager';
import { initStorage, resetStorageForTests } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-context-test',
  Date.now().toString()
);

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    initStorage(TEST_DIR);
    manager = new ContextManager();
  });

  afterEach(async () => {
    resetStorageForTests();
    resetLoggerForTests();
    await fs.remove(TEST_DIR);
  });

  it('should use provided permission mode when creating new session', async () => {
    const context = await manager.load('user-1', {
      defaultAgent: 'iflow',
      workingDir: '/tmp/project',
      permissionMode: 'auto',
    });

    expect(context.permissionMode).toBe('auto');
  });

  it('should preserve stored session values when load defaults differ', async () => {
    const initial = await manager.load('user-2', {
      defaultAgent: 'iflow',
      workingDir: '/tmp/project-a',
      permissionMode: 'auto',
    });

    initial.defaultAgent = 'codex';
    initial.workingDir = '/tmp/project-b';
    initial.permissionMode = 'plan';
    initial.lastActivity = new Date();
    await manager.save(initial);

    const reloaded = await manager.load('user-2', {
      defaultAgent: 'iflow',
      workingDir: '/tmp/project-a',
      permissionMode: 'auto',
    });

    expect(reloaded.defaultAgent).toBe('codex');
    expect(reloaded.workingDir).toBe('/tmp/project-b');
    expect(reloaded.permissionMode).toBe('plan');
  });

  it('should create and resolve approval requests', async () => {
    await manager.load('user-3', {
      defaultAgent: 'iflow',
      workingDir: '/tmp/project',
      permissionMode: 'auto',
    });

    const approval = await manager.createApprovalRequest('user-3', {
      tool: 'codex',
      action: 'edit src/app.ts',
      category: 'edit',
      file: 'src/app.ts',
      timeout: 120,
    });
    await manager.createPendingExecution('user-3', {
      requestId: approval.id,
      task: 'edit src/app.ts',
      agentName: 'codex',
      workingDir: '/tmp/project',
      category: 'edit',
    });

    const pendingApprovals = await manager.listPendingApprovals('user-3');
    expect(pendingApprovals).toHaveLength(1);
    expect(pendingApprovals[0].id).toBe(approval.id);

    const resolution = await manager.resolveApprovalRequest(
      'user-3',
      'approved',
      approval.id.substring(0, 8)
    );
    expect(resolution.status).toBe('resolved');
    expect(resolution.approval?.status).toBe('approved');

    const pendingAfterResolution = await manager.listPendingApprovals('user-3');
    expect(pendingAfterResolution).toHaveLength(0);

    const reloaded = await manager.load('user-3');
    expect(reloaded.state.approvalRequests).toHaveLength(1);
    expect(reloaded.state.approvalRequests[0].status).toBe('approved');
    expect(reloaded.state.pendingExecutions).toHaveLength(1);
    expect(reloaded.state.pendingExecutions[0].status).toBe('approved');
    expect(
      reloaded.state.decisions.some(item => item.decision.includes('权限请求'))
    ).toBe(true);
  });

  it('should report ambiguous resolution when multiple approvals exist', async () => {
    await manager.load('user-4', {
      defaultAgent: 'iflow',
      workingDir: '/tmp/project',
      permissionMode: 'auto',
    });

    await manager.createApprovalRequest('user-4', {
      tool: 'codex',
      action: 'edit src/a.ts',
      category: 'edit',
      timeout: 120,
    });

    await manager.createApprovalRequest('user-4', {
      tool: 'codex',
      action: 'edit src/b.ts',
      category: 'edit',
      timeout: 120,
    });

    const resolution = await manager.resolveApprovalRequest('user-4', 'denied');
    expect(resolution.status).toBe('ambiguous');
    expect(resolution.matches).toHaveLength(2);
  });

  it('should expire overdue approvals and pending executions on load', async () => {
    const context = await manager.load('user-5', {
      defaultAgent: 'iflow',
      workingDir: '/tmp/project',
      permissionMode: 'auto',
    });

    const approval = await manager.createApprovalRequest('user-5', {
      tool: 'codex',
      action: 'deploy application',
      category: 'network',
      timeout: 1,
    });
    await manager.createPendingExecution('user-5', {
      requestId: approval.id,
      task: 'deploy application',
      agentName: 'codex',
      workingDir: '/tmp/project',
      category: 'network',
    });

    const stored = await manager.load('user-5');
    stored.state.approvalRequests[0].expiresAt = new Date(Date.now() - 1000);
    stored.lastActivity = new Date();
    await manager.save(stored);

    const reloaded = await manager.load('user-5', {
      permissionMode: 'auto',
    });
    expect(reloaded.state.approvalRequests[0].status).toBe('expired');
    expect(reloaded.state.pendingExecutions[0].status).toBe('expired');
  });
});
