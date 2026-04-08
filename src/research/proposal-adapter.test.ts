import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { initStorage, resetStorageForTests, storage } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';
import { ResearchProposalAdapter } from './proposal-adapter';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-research-test',
  Date.now().toString()
);

describe('ResearchProposalAdapter', () => {
  beforeEach(() => {
    initStorage(TEST_DIR);
  });

  afterEach(async () => {
    resetStorageForTests();
    resetLoggerForTests();
    await fs.remove(TEST_DIR);
  });

  it('should prepare proposal artifacts and prompt', async () => {
    const adapter = new ResearchProposalAdapter();

    const result = await adapter.prepareWorkflow({
      route: 'research_plan',
      requestText: '给我一个关于小模型路由效率的研究计划',
      userId: 'user-1',
      jobId: 'job-1',
      workingDir: '/tmp/project',
      defaultAgent: 'codex',
      availableAgents: ['codex', 'claude'],
    });

    expect(result.agentName).toBe('codex');
    expect(result.prompt).toContain('不要启动真实实验');
    expect(result.artifacts).toHaveLength(5);
    expect(
      await fs.pathExists(
        path.join(storage.sessionsDir, 'user-1', 'artifacts', 'job-1', 'proposal.md')
      )
    ).toBe(true);
  });
});
