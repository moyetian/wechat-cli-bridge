import { EventEmitter } from 'events';
import { CLIAdapter } from './cli-adapter';
import { AgentConfig } from '../types';

const spawnMock = jest.fn();
const spawnSyncMock = jest.fn();

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock.apply(null, args),
  spawnSync: (...args: unknown[]) => spawnSyncMock.apply(null, args),
}));

function createMockChild(stdout = '任务完成') {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = {
    write: jest.fn(),
    end: jest.fn(),
  };
  child.kill = jest.fn();

  process.nextTick(() => {
    child.stdout.emit('data', Buffer.from(stdout));
    child.emit('close', 0);
  });

  return child;
}

function expectSpawnInvocation(command: string, args: string[], cwd: string): void {
  if (process.platform === 'win32') {
    const commandStr = [command, ...args.map(arg => (/\s/.test(arg) ? `"${arg}"` : arg))].join(' ');
    expect(spawnMock).toHaveBeenCalledWith(
      commandStr,
      [],
      expect.objectContaining({
        cwd,
        shell: true,
        windowsHide: true,
      })
    );
    return;
  }

  expect(spawnMock).toHaveBeenCalledWith(
    command,
    args,
    expect.objectContaining({
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  );
}

describe('CLIAdapter permission enforcement', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnSyncMock.mockReset();
    spawnSyncMock.mockImplementation((command: string, args?: string[]) => {
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return { status: 0, stdout: Buffer.from('true\n') };
      }

      return { status: 0, stdout: Buffer.from('') };
    });
  });

  it('should use positional args for codex exec', async () => {
    const config: AgentConfig = {
      type: 'cli',
      command: 'codex',
      args: ['exec'],
      permissionProfile: {
        invocationMode: 'positional',
        permissionArgs: {
          auto: ['--full-auto'],
        },
      },
    };
    spawnMock.mockReturnValueOnce(createMockChild());

    const adapter = new CLIAdapter('codex', config);
    await adapter.execute('fix auth flow', {
      workingDir: '/tmp/project',
      permissionMode: 'acceptEdits',
    });

    expectSpawnInvocation('codex', ['exec', 'fix auth flow'], '/tmp/project');
  });

  it('should escalate approved tasks to auto mode args', async () => {
    const config: AgentConfig = {
      type: 'cli',
      command: 'codex',
      args: ['exec'],
      permissionProfile: {
        invocationMode: 'positional',
        permissionArgs: {
          auto: ['--full-auto'],
        },
      },
    };
    spawnMock.mockReturnValueOnce(createMockChild());

    const adapter = new CLIAdapter('codex', config);
    await adapter.execute('fix auth flow', {
      workingDir: '/tmp/project',
      permissionMode: 'interactive',
      bridgeApproved: true,
    });

    expectSpawnInvocation('codex', ['exec', '--full-auto', 'fix auth flow'], '/tmp/project');
  });

  it('should bypass codex repo check outside git working trees', async () => {
    spawnSyncMock.mockImplementation((command: string, args?: string[]) => {
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return { status: 128, stdout: Buffer.from('') };
      }

      return { status: 0, stdout: Buffer.from('') };
    });
    const config: AgentConfig = {
      type: 'cli',
      command: 'codex',
      args: ['exec'],
      permissionProfile: {
        invocationMode: 'positional',
        permissionArgs: {
          auto: ['--full-auto'],
        },
      },
    };
    spawnMock.mockReturnValueOnce(createMockChild());

    const adapter = new CLIAdapter('codex', config);
    await adapter.execute('fix auth flow', {
      workingDir: '/tmp/non-repo',
      permissionMode: 'acceptEdits',
    });

    expectSpawnInvocation(
      'codex',
      ['exec', '--skip-git-repo-check', 'fix auth flow'],
      '/tmp/non-repo'
    );
  });

  it('should pass additional writable directories to codex', async () => {
    const config: AgentConfig = {
      type: 'cli',
      command: 'codex',
      args: ['exec'],
      permissionProfile: {
        invocationMode: 'positional',
      },
    };
    spawnMock.mockReturnValueOnce(createMockChild());

    const adapter = new CLIAdapter('codex', config);
    await adapter.execute('fix auth flow', {
      workingDir: '/tmp/project',
      writableDirs: ['/tmp/artifacts/job-1'],
      permissionMode: 'acceptEdits',
    });

    expectSpawnInvocation(
      'codex',
      ['exec', '--add-dir', '/tmp/artifacts/job-1', 'fix auth flow'],
      '/tmp/project'
    );
  });

  it('should use stdin prompt flow for multiline positional CLIs', async () => {
    const config: AgentConfig = {
      type: 'cli',
      command: 'iflow',
      permissionProfile: {
        invocationMode: 'positional',
        promptArgs: ['-p'],
        permissionArgs: {
          auto: ['-y'],
        },
      },
    };
    const child = createMockChild();
    spawnMock.mockReturnValueOnce(child);

    const adapter = new CLIAdapter('iflow', config);
    await adapter.execute('line1\nline2', {
      workingDir: '/tmp/project',
      permissionMode: 'auto',
    });

    expectSpawnInvocation('iflow', ['-y', '-p'], '/tmp/project');
    expect(child.stdin.write).toHaveBeenCalledWith('line1\nline2');
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it('should treat claude as unavailable when auth status reports logged out', async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('/usr/bin/claude\n') })
      .mockReturnValueOnce({
        status: 1,
        stdout: Buffer.from(JSON.stringify({ loggedIn: false })),
      });

    const adapter = new CLIAdapter('claude', {
      type: 'cli',
      command: 'claude',
    });

    await expect(adapter.isAvailable()).resolves.toBe(false);
  });

  it('should treat claude as available when auth status reports logged in', async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('/usr/bin/claude\n') })
      .mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from(JSON.stringify({ loggedIn: true })),
      });

    const adapter = new CLIAdapter('claude', {
      type: 'cli',
      command: 'claude',
    });

    await expect(adapter.isAvailable()).resolves.toBe(true);
  });
});
