import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { resetStorageForTests } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';
import { runLocalM005MockUat } from './local-m005';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-local-m005-uat-test',
  Date.now().toString()
);

describe('runLocalM005MockUat', () => {
  afterEach(async () => {
    resetStorageForTests();
    resetLoggerForTests();
    await fs.remove(TEST_DIR);
  });

  it('should run article and research local mock UAT flows and write a report', async () => {
    const result = await runLocalM005MockUat({
      homeDir: TEST_DIR,
      workingDir: '/tmp/project',
    });

    expect(result.article.status).toBe('completed_local');
    expect(await fs.pathExists(result.article.outlinePath)).toBe(true);
    expect(await fs.pathExists(result.article.draftPath)).toBe(true);
    expect(result.research.status).toBe('completed');
    expect(result.research.runId).toBeDefined();
    expect(await fs.pathExists(result.reportPath)).toBe(true);
    expect(await fs.readFile(result.reportPath, 'utf8')).toContain('M005 Local Mock UAT');
  });
});
