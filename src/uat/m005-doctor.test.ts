import fs from 'fs-extra';
import http from 'http';
import os from 'os';
import path from 'path';
import { RemoteResearchExecutorServer } from '../research/remote-http-server';
import { runM005Doctor } from './m005-doctor';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-m005-doctor-test',
  Date.now().toString()
);

describe('runM005Doctor', () => {
  const originalPath = process.env.PATH;
  const originalBotToken = process.env.ILINK_BOT_TOKEN;
  const originalAccountId = process.env.ILINK_ACCOUNT_ID;
  const originalWeWritePath = process.env.WEWRITE_SKILL_PATH;
  let remoteServer: RemoteResearchExecutorServer | undefined;

  async function reserveClosedPort(): Promise<number> {
    const server = http.createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('failed to reserve port');
    }
    const { port } = address;
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    return port;
  }

  afterEach(async () => {
    if (remoteServer) {
      await remoteServer.stop();
      remoteServer = undefined;
    }
    process.env.PATH = originalPath;
    if (originalBotToken === undefined) {
      delete process.env.ILINK_BOT_TOKEN;
    } else {
      process.env.ILINK_BOT_TOKEN = originalBotToken;
    }
    if (originalAccountId === undefined) {
      delete process.env.ILINK_ACCOUNT_ID;
    } else {
      process.env.ILINK_ACCOUNT_ID = originalAccountId;
    }
    if (originalWeWritePath === undefined) {
      delete process.env.WEWRITE_SKILL_PATH;
    } else {
      process.env.WEWRITE_SKILL_PATH = originalWeWritePath;
    }
    await fs.remove(TEST_DIR);
  });

  it('should report failures when config and credentials are missing', async () => {
    const result = await runM005Doctor({
      homeDir: path.join(TEST_DIR, 'missing-env'),
    });

    expect(result.summary.fail).toBeGreaterThan(0);
    expect(result.checks.find(item => item.id === 'config')?.status).toBe('fail');
    expect(result.checks.find(item => item.id === 'ilink_credentials')?.status).toBe('fail');
    expect(await fs.pathExists(result.reportPath)).toBe(true);
  });

  it('should report pass or warn for a prepared local environment', async () => {
    const homeDir = path.join(TEST_DIR, 'prepared-env');
    const binDir = path.join(TEST_DIR, 'bin');
    const skillDir = path.join(TEST_DIR, 'wewrite');
    await fs.ensureDir(homeDir);
    await fs.ensureDir(binDir);
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(binDir, 'claude'), '#!/bin/sh\nexit 0\n', 'utf8');
    await fs.chmod(path.join(binDir, 'claude'), 0o755);
    process.env.PATH = `${binDir}:${originalPath || ''}`;
    process.env.ILINK_BOT_TOKEN = 'token';
    process.env.ILINK_ACCOUNT_ID = 'account';
    process.env.WEWRITE_SKILL_PATH = skillDir;

    await fs.writeJson(
      path.join(homeDir, 'config.json'),
      {
        defaultAgent: 'codex',
        workingDirectory: '/tmp/project',
        agents: {
          codex: {
            type: 'cli',
            command: 'claude',
          },
          claude: {
            type: 'cli',
            command: 'claude',
          },
        },
        research: {
          enabled: true,
          executor: {
            backend: 'local_gpu',
            localGpu: {
              queueDir: path.join(homeDir, 'queue'),
              statusDir: path.join(homeDir, 'queue', 'status'),
              pythonBin: 'python3',
            },
          },
        },
      },
      { spaces: 2 }
    );

    const result = await runM005Doctor({ homeDir });

    expect(result.checks.find(item => item.id === 'config')?.status).toBe('pass');
    expect(result.checks.find(item => item.id === 'ilink_credentials')?.status).toBe('pass');
    expect(result.checks.find(item => item.id === 'writing_lane')?.status).toBe('pass');
    expect(result.checks.find(item => item.id === 'research_lane')?.status).toBe('pass');
  });

  it('should warn when research executor remains disabled', async () => {
    const homeDir = path.join(TEST_DIR, 'research-disabled');
    const binDir = path.join(TEST_DIR, 'disabled-bin');
    const skillDir = path.join(TEST_DIR, 'disabled-wewrite');
    await fs.ensureDir(homeDir);
    await fs.ensureDir(binDir);
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(binDir, 'claude'), '#!/bin/sh\nexit 0\n', 'utf8');
    await fs.chmod(path.join(binDir, 'claude'), 0o755);
    process.env.PATH = `${binDir}:${originalPath || ''}`;
    process.env.ILINK_BOT_TOKEN = 'token';
    process.env.ILINK_ACCOUNT_ID = 'account';
    process.env.WEWRITE_SKILL_PATH = skillDir;

    await fs.writeJson(
      path.join(homeDir, 'config.json'),
      {
        defaultAgent: 'claude',
        workingDirectory: '/tmp/project',
        agents: {
          claude: {
            type: 'cli',
            command: 'claude',
          },
        },
        research: {
          enabled: false,
          executor: {
            backend: 'local_gpu',
            localGpu: {
              queueDir: path.join(homeDir, 'queue'),
              statusDir: path.join(homeDir, 'queue', 'status'),
              pythonBin: 'python3',
            },
          },
        },
      },
      { spaces: 2 }
    );

    const result = await runM005Doctor({ homeDir });

    expect(result.checks.find(item => item.id === 'research_lane')?.status).toBe('warn');
    expect(result.nextActions).toContain(
      '若要验证真实 research lane，请将 `research.enabled` 设为 `true`。'
    );
  });

  it('should pass when remote_http endpoint is actually reachable', async () => {
    const homeDir = path.join(TEST_DIR, 'remote-http-ready');
    const binDir = path.join(TEST_DIR, 'remote-http-bin');
    const skillDir = path.join(TEST_DIR, 'remote-http-wewrite');
    await fs.ensureDir(homeDir);
    await fs.ensureDir(binDir);
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(binDir, 'iflow'), '#!/bin/sh\nexit 0\n', 'utf8');
    await fs.chmod(path.join(binDir, 'iflow'), 0o755);
    process.env.PATH = `${binDir}:${originalPath || ''}`;
    process.env.ILINK_BOT_TOKEN = 'token';
    process.env.ILINK_ACCOUNT_ID = 'account';
    process.env.WEWRITE_SKILL_PATH = skillDir;

    remoteServer = new RemoteResearchExecutorServer({
      storageDir: path.join(TEST_DIR, 'remote-http-storage'),
      host: '127.0.0.1',
      port: 0,
      pollIntervalMs: 0,
      simulateDurationMs: 0,
      apiKey: 'secret-token',
    });
    const endpoint = await remoteServer.start();

    await fs.writeJson(
      path.join(homeDir, 'config.json'),
      {
        defaultAgent: 'iflow',
        workingDirectory: '/tmp/project',
        agents: {
          iflow: {
            type: 'cli',
            command: 'iflow',
          },
        },
        research: {
          enabled: true,
          executor: {
            backend: 'remote_http',
            remoteHttp: {
              endpoint,
              apiKey: 'secret-token',
            },
          },
        },
      },
      { spaces: 2 }
    );

    const result = await runM005Doctor({ homeDir });

    expect(result.checks.find(item => item.id === 'research_lane')?.status).toBe('pass');
    expect(result.checks.find(item => item.id === 'research_lane')?.detail).toContain(
      'remote_http endpoint reachable'
    );
  });

  it('should fail when remote_http endpoint is configured but unreachable', async () => {
    const homeDir = path.join(TEST_DIR, 'remote-http-down');
    const binDir = path.join(TEST_DIR, 'remote-http-down-bin');
    const skillDir = path.join(TEST_DIR, 'remote-http-down-wewrite');
    await fs.ensureDir(homeDir);
    await fs.ensureDir(binDir);
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(binDir, 'iflow'), '#!/bin/sh\nexit 0\n', 'utf8');
    await fs.chmod(path.join(binDir, 'iflow'), 0o755);
    process.env.PATH = `${binDir}:${originalPath || ''}`;
    process.env.ILINK_BOT_TOKEN = 'token';
    process.env.ILINK_ACCOUNT_ID = 'account';
    process.env.WEWRITE_SKILL_PATH = skillDir;

    const closedPort = await reserveClosedPort();

    await fs.writeJson(
      path.join(homeDir, 'config.json'),
      {
        defaultAgent: 'iflow',
        workingDirectory: '/tmp/project',
        agents: {
          iflow: {
            type: 'cli',
            command: 'iflow',
          },
        },
        research: {
          enabled: true,
          executor: {
            backend: 'remote_http',
            remoteHttp: {
              endpoint: `http://127.0.0.1:${closedPort}`,
              apiKey: 'secret-token',
            },
          },
        },
      },
      { spaces: 2 }
    );

    const result = await runM005Doctor({ homeDir });

    expect(result.checks.find(item => item.id === 'research_lane')?.status).toBe('fail');
    expect(result.nextActions).toContain(
      '运行 `npm run uat:m005-remote-probe -- --timeout-ms 4000`，确认公网 endpoint、health 与 research API 路由是否都可达。'
    );
  });
});
