import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { ContextManager } from '../context/manager';
import { initStorage, resetStorageForTests } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';
import { PRISMMemoryCore, selectMemoryLoadProfile } from './core';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-memory-test',
  Date.now().toString()
);

describe('PRISMMemoryCore', () => {
  let manager: ContextManager;
  let memoryCore: PRISMMemoryCore;

  beforeEach(() => {
    initStorage(TEST_DIR);
    manager = new ContextManager();
    memoryCore = new PRISMMemoryCore(manager);
  });

  afterEach(async () => {
    resetStorageForTests();
    resetLoggerForTests();
    await fs.remove(TEST_DIR);
  });

  it('should select deep profile for approval-gated research runs', () => {
    expect(
      selectMemoryLoadProfile({
        route: 'research_run_request',
        lane: 'research',
        gate: 'approval_required',
      })
    ).toBe('deep');
  });

  it('should select standard profile for article workflows', () => {
    expect(
      selectMemoryLoadProfile({
        route: 'article_create',
        lane: 'writing',
        gate: 'none',
      })
    ).toBe('standard');
  });

  it('should build quick and deep bundles with different tiers', async () => {
    await manager.load('user-1', {
      defaultAgent: 'codex',
      workingDir: '/tmp/project',
      permissionMode: 'interactive',
    });

    await manager.update('user-1', {
      task: '修改 src/app.ts',
      result: 'done',
      agent: 'codex',
      success: true,
      filesModified: ['src/app.ts'],
      decision: '已采用新的登录策略',
    });
    await manager.update('user-1', {
      task: '新增 tests/auth.test.ts',
      result: 'done',
      agent: 'codex',
      success: true,
      filesModified: ['tests/auth.test.ts'],
    });
    await manager.createWorkflowJob('user-1', {
      route: 'article_create',
      lane: 'writing',
      inputText: '写一篇关于 AI 路由的公众号文章',
      summary: '创建新的公众号文章工作流',
      status: 'planned',
      workingDir: '/tmp/project',
    });
    const stored = await manager.load('user-1');
    stored.state.blockers.push('需要补充实验环境信息');
    stored.lastActivity = new Date();
    await manager.save(stored);

    const quick = await memoryCore.loadBundle({
      userId: 'user-1',
      task: '查看当前状态',
      route: 'general_cli_task',
      lane: 'general_cli',
    });
    const deep = await memoryCore.loadBundle({
      userId: 'user-1',
      route: 'research_run_request',
      lane: 'research',
      gate: 'approval_required',
    });

    expect(quick.profile).toBe('quick');
    expect(quick.rendered).toContain('# PRISM Memory (quick)');
    expect(quick.entries.some(entry => entry.tier === 'hot')).toBe(true);
    expect(quick.entries.some(entry => entry.tier === 'cold')).toBe(false);

    expect(deep.profile).toBe('deep');
    expect(deep.rendered).toContain('# PRISM Memory (deep)');
    expect(deep.entries.some(entry => entry.tier === 'cold')).toBe(true);
  });
});
