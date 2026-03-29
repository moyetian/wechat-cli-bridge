import { EventEmitter } from 'events';
import { CLIAdapter } from './cli-adapter';
import { AgentConfig } from '../types';

const spawnMock = jest.fn();
const spawnSyncMock = jest.fn(() => ({ status: 0 }));

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
    spawnSyncMock.mockClear();
  });

  it('should use mode-specific args for non-interactive prompt-flag CLIs', async () => {
    const config: AgentConfig = {
      type: 'cli',
      command: 'codex',
      permissionProfile: {
        invocationMode: 'prompt_flag',
        promptArgs: ['-p'],
        permissionArgs: {
          interactive: ['--suggest'],
          acceptEdits: ['--auto-edit'],
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

    expectSpawnInvocation('codex', ['--auto-edit', '-p', 'fix auth flow'], '/tmp/project');
  });

  it('should escalate approved tasks to auto mode args', async () => {
    const config: AgentConfig = {
      type: 'cli',
      command: 'codex',
      permissionProfile: {
        invocationMode: 'prompt_flag',
        promptArgs: ['-p'],
        permissionArgs: {
          interactive: ['--suggest'],
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

    expectSpawnInvocation('codex', ['--full-auto', '-p', 'fix auth flow'], '/tmp/project');
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
});
