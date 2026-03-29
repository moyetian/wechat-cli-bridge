import { AgentConfig } from '../types';
import { buildCLIInvocationPlan, getEffectivePermissionMode } from './cli-permissions';

describe('cli permission profiles', () => {
  it('should build positional args for iflow edit task', () => {
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

    const plan = buildCLIInvocationPlan(config, '修复登录 bug', 'interactive');
    expect(plan.args).toEqual(['修复登录 bug']);
    expect(plan.promptViaStdin).toBe(false);
  });

  it('should build multiline iflow invocation with prompt flag', () => {
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

    const plan = buildCLIInvocationPlan(config, 'line1\nline2', 'auto');
    expect(plan.args).toEqual(['-y', '-p']);
    expect(plan.promptViaStdin).toBe(true);
  });

  it('should map claude permission modes to official flags', () => {
    const config: AgentConfig = {
      type: 'cli',
      command: 'claude',
      args: ['-p', '--dangerously-skip-permissions'],
      permissionProfile: {
        invocationMode: 'prompt_flag',
        promptArgs: ['-p'],
        permissionArgs: {
          interactive: ['--permission-mode', 'default'],
          acceptEdits: ['--permission-mode', 'acceptEdits'],
          auto: ['--dangerously-skip-permissions'],
        },
      },
    };

    expect(
      buildCLIInvocationPlan(config, 'fix auth', 'interactive').args
    ).toEqual(['--permission-mode', 'default', '-p', 'fix auth']);
    expect(
      buildCLIInvocationPlan(config, 'fix auth', 'acceptEdits').args
    ).toEqual(['--permission-mode', 'acceptEdits', '-p', 'fix auth']);
    expect(buildCLIInvocationPlan(config, 'fix auth', 'auto').args).toEqual([
      '--dangerously-skip-permissions',
      '-p',
      'fix auth',
    ]);
  });

  it('should map codex and gemini modes to current official flags', () => {
    const codexConfig: AgentConfig = {
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

    const geminiConfig: AgentConfig = {
      type: 'cli',
      command: 'gemini',
      permissionProfile: {
        invocationMode: 'prompt_flag',
        promptArgs: ['-p'],
        permissionArgs: {
          interactive: ['--approval-mode', 'default'],
          acceptEdits: ['--approval-mode', 'auto_edit'],
          auto: ['--approval-mode', 'yolo'],
        },
      },
    };

    expect(
      buildCLIInvocationPlan(codexConfig, 'fix auth', 'acceptEdits').args
    ).toEqual(['--auto-edit', '-p', 'fix auth']);
    expect(buildCLIInvocationPlan(codexConfig, 'fix auth', 'auto').args).toEqual([
      '--full-auto',
      '-p',
      'fix auth',
    ]);
    expect(
      buildCLIInvocationPlan(geminiConfig, 'fix auth', 'acceptEdits').args
    ).toEqual(['--approval-mode', 'auto_edit', '-p', 'fix auth']);
  });

  it('should escalate approved tasks to auto execution mode', () => {
    expect(getEffectivePermissionMode('interactive', true)).toBe('auto');
    expect(getEffectivePermissionMode('acceptEdits', true)).toBe('auto');
    expect(getEffectivePermissionMode('plan', true)).toBe('auto');
  });
});
