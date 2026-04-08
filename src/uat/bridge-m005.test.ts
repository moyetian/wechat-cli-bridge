import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { resetStorageForTests } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';
import { runLocalM005BridgeUat } from './bridge-m005';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-bridge-m005-uat-test',
  Date.now().toString()
);

describe('runLocalM005BridgeUat', () => {
  afterEach(async () => {
    resetStorageForTests();
    resetLoggerForTests();
    await fs.remove(TEST_DIR);
  });

  it('should drive bridge article and research workflows through the local mock UAT flow', async () => {
    const result = await runLocalM005BridgeUat({
      homeDir: TEST_DIR,
      workingDir: '/tmp/project',
    });

    expect(result.articleJobStatus).toBe('completed');
    expect(result.researchJobStatus).toBe('completed');
    expect(result.researchRunId).toBeDefined();
    expect(await fs.pathExists(result.reportPath)).toBe(true);
    expect(await fs.pathExists(result.transcriptPath)).toBe(true);
  });
});
