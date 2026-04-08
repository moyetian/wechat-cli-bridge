import { spawn, ChildProcess, spawnSync } from 'child_process';
import { BaseAgent } from './base';
import { AgentConfig, ExecuteOptions, ExecuteResult } from '../types';
import { buildCLIInvocationPlan } from './cli-permissions';
import logger from '../utils/logger';

/**
 * Potentially dangerous patterns in task input
 */
const DANGEROUS_PATTERNS = [
  /[;&|`$]/,           // Command chaining/injection
  /\$\(/,              // Command substitution
  /\$\{/,              // Variable expansion
  /\|\|/,              // OR operator
  /&&/,                // AND operator
  />\s*\//,            // Redirect to absolute path
  /<\s*\//,            // Redirect from absolute path
];

/**
 * Sanitize input for shell execution
 * Escapes dangerous characters and logs warnings for suspicious patterns
 */
function sanitizeInput(input: string): { safe: string; warnings: string[] } {
  const warnings: string[] = [];
  let safe = input;

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      warnings.push(`Input contains potentially dangerous pattern: ${pattern.source}`);
    }
  }

  // For Windows cmd, escape special characters
  if (process.platform === 'win32') {
    // Escape double quotes by doubling them
    safe = safe.replace(/"/g, '""');
    // Escape % for cmd
    safe = safe.replace(/%/g, '%%');
    // Escape ^ for cmd
    safe = safe.replace(/\^/g, '^^');
  } else {
    // For Unix shells, escape single quotes and wrap in single quotes
    safe = `'${safe.replace(/'/g, "'\\''")}'`;
  }

  return { safe, warnings };
}

function escapeWindowsShellArg(arg: string): string {
  const escaped = arg
    .replace(/\^/g, '^^')
    .replace(/%/g, '%%')
    .replace(/"/g, '""');
  return /[\s&|<>^()%!]/.test(escaped) ? `"${escaped}"` : escaped;
}

function isGitWorkTree(cwd: string, env: NodeJS.ProcessEnv): boolean {
  try {
    const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
      env,
      timeout: 5000,
    });
    return (
      result.status === 0 &&
      result.stdout?.toString().trim() === 'true'
    );
  } catch {
    return false;
  }
}

function maybeAddCodexRepoCheckBypass(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): string[] {
  if (
    command !== 'codex' ||
    args[0] !== 'exec' ||
    args.includes('--skip-git-repo-check') ||
    isGitWorkTree(cwd, env)
  ) {
    return args;
  }

  const augmentedArgs = [...args];
  augmentedArgs.splice(1, 0, '--skip-git-repo-check');
  return augmentedArgs;
}

function maybeAddCodexWritableDirs(
  command: string,
  args: string[],
  writableDirs?: string[]
): string[] {
  if (command !== 'codex' || args[0] !== 'exec' || !writableDirs?.length) {
    return args;
  }

  const existingWritableDirs = new Set<string>();
  for (let index = 1; index < args.length - 1; index++) {
    if (args[index] === '--add-dir') {
      existingWritableDirs.add(args[index + 1]);
    }
  }

  const dirsToAdd = writableDirs.filter(
    dir => dir && !existingWritableDirs.has(dir)
  );
  if (dirsToAdd.length === 0) {
    return args;
  }

  return [
    'exec',
    ...dirsToAdd.flatMap(dir => ['--add-dir', dir]),
    ...args.slice(1),
  ];
}

/**
 * CLI Adapter - Execute CLI-based agents
 * 
 * Supports agents like:
 * - iFlow CLI (task as positional argument)
 * - Codex CLI  
 * - Gemini CLI
 * - Claude Code (CLI mode, task via stdin with -p flag)
 */
export class CLIAdapter extends BaseAgent {
  private activeProcess: ChildProcess | null = null;

  constructor(name: string, config: AgentConfig) {
    super(name, config);
  }

  async execute(task: string, options: ExecuteOptions): Promise<ExecuteResult> {
    const startTime = Date.now();
    const timeout = this.config.timeout || 600000; // 10 min default

    logger.info(`[${this.name}] Executing task: ${task.substring(0, 100)}...`);

    try {
      // Prepare input with context
      const input = this.formatTaskWithInput(task, options.context);

      // Execute
      const result = await this.runCommand(input, {
        cwd: options.workingDir,
        timeout,
        env: this.getEnv(),
        writableDirs: options.writableDirs,
        permissionMode: options.permissionMode,
        bridgeApproved: options.bridgeApproved,
      });

      const duration = Date.now() - startTime;
      logger.info(`[${this.name}] Task completed in ${duration}ms`);

      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr || undefined,
        summary: this.extractSummary(result.stdout),
        filesModified: this.extractModifiedFiles(result.stdout),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.name}] Execution failed:`, errorMessage);

      return {
        success: false,
        output: '',
        error: errorMessage,
        summary: `执行失败: ${errorMessage}`,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    const command = this.config.command;
    if (!command) {
      return false;
    }

    try {
      // Try to find the command
      const result = spawnSync(
        process.platform === 'win32' ? 'where' : 'which',
        [command],
        { timeout: 5000 }
      );
      if (result.status !== 0) {
        return false;
      }

      if (command === 'claude') {
        return this.isClaudeAuthReady();
      }

      return true;
    } catch {
      return false;
    }
  }

  private isClaudeAuthReady(): boolean {
    const mergedEnv = {
      ...process.env,
      ...(this.config.env || {}),
    };

    if (mergedEnv.ANTHROPIC_API_KEY || mergedEnv.ANTHROPIC_AUTH_TOKEN) {
      return true;
    }

    try {
      const status = spawnSync('claude', ['auth', 'status'], {
        timeout: 5000,
        env: mergedEnv,
      });
      const stdout = status.stdout
        ? status.stdout.toString().trim()
        : '';

      if (!stdout) {
        return false;
      }

      const parsed = JSON.parse(stdout) as { loggedIn?: boolean };
      return parsed.loggedIn === true;
    } catch {
      return false;
    }
  }

  /**
   * Get environment variables
   */
  private getEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ...(this.config.env || {}),
      // Disable interactive prompts
      CI: 'true',
      TERM: 'dumb',
      NO_COLOR: '1',
    };
  }

  /**
   * Run command and capture output
   * iFlow expects task as positional argument for single line,
   * or via stdin with -p flag for multiline
   */
  private runCommand(
    input: string,
    options: {
      cwd: string;
      timeout: number;
      env: NodeJS.ProcessEnv;
      writableDirs?: string[];
      permissionMode?: ExecuteOptions['permissionMode'];
      bridgeApproved?: boolean;
    }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let isTimedOut = false;
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        if (this.activeProcess) {
          this.activeProcess.kill('SIGTERM');
          // Force kill after 5 seconds if still running
          setTimeout(() => {
            if (this.activeProcess) {
              this.activeProcess.kill('SIGKILL');
            }
          }, 5000);
        }
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);

      let stdout = '';
      let stderr = '';

      const command = this.config.command!;
      const useShell = process.platform === 'win32';
      const invocationPlan = buildCLIInvocationPlan(
        this.config,
        input,
        options.permissionMode,
        options.bridgeApproved
      );
      const commandArgs = maybeAddCodexRepoCheckBypass(
        command,
        invocationPlan.args,
        options.cwd,
        options.env
      );
      const finalArgs = maybeAddCodexWritableDirs(
        command,
        commandArgs,
        options.writableDirs
      );
      
      // Sanitize input and check for dangerous patterns
      const { warnings } = sanitizeInput(input);
      
      // Log warnings for suspicious input
      if (warnings.length > 0) {
        logger.warn(`[${this.name}] Input sanitization warnings:`, warnings);
      }

      if (invocationPlan.promptViaStdin) {
        if (useShell) {
          const commandStr = [
            command,
            ...finalArgs.map(escapeWindowsShellArg),
          ].join(' ');
          this.activeProcess = spawn(commandStr, [], {
            cwd: options.cwd,
            env: options.env,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
            windowsHide: true,
          });
        } else {
          this.activeProcess = spawn(command, finalArgs, {
            cwd: options.cwd,
            env: options.env,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        }
        
        // Write original input to stdin (stdin doesn't need shell escaping)
        if (this.activeProcess.stdin) {
          this.activeProcess.stdin.write(input);
          this.activeProcess.stdin.end();
        }
      } else {
        if (useShell) {
          const commandStr = [
            command,
            ...finalArgs.map(escapeWindowsShellArg),
          ].join(' ');
          this.activeProcess = spawn(commandStr, [], {
            cwd: options.cwd,
            env: options.env,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
            windowsHide: true,
          });
        } else {
          this.activeProcess = spawn(command, finalArgs, {
            cwd: options.cwd,
            env: options.env,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        }
        
        // Close stdin since we passed task as argument
        if (this.activeProcess.stdin) {
          this.activeProcess.stdin.end();
        }
      }

      this.activeProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        logger.debug(`[${this.name}] stdout: ${data.toString().substring(0, 200)}`);
      });

      this.activeProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        logger.debug(`[${this.name}] stderr: ${data.toString().substring(0, 200)}`);
      });

      this.activeProcess.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        this.activeProcess = null;
        reject(error);
      });

      this.activeProcess.on('close', (code: number) => {
        clearTimeout(timeoutId);
        this.activeProcess = null;
        
        // If timed out, the promise was already rejected
        if (!isTimedOut) {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code,
          });
        }
      });
    });
  }

  /**
   * Kill active process
   */
  kill(): void {
    if (this.activeProcess) {
      this.activeProcess.kill();
      this.activeProcess = null;
      logger.info(`[${this.name}] Process killed`);
    }
  }
}

export default CLIAdapter;
