import { spawn, ChildProcess, spawnSync } from 'child_process';
import { BaseAgent } from './base';
import { AgentConfig, ExecuteOptions, ExecuteResult } from '../types';
import logger from '../utils/logger';

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
      return result.status === 0;
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
    }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.activeProcess) {
          this.activeProcess.kill();
        }
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);

      let stdout = '';
      let stderr = '';

      const command = this.config.command!;
      const baseArgs = this.config.args || [];
      const useShell = process.platform === 'win32';
      
      // Check if input is multiline or has special chars that need escaping
      const isMultiline = input.includes('\n') || input.includes('\r');
      
      if (isMultiline) {
        // Use -p flag and pass input via stdin
        const args = [...baseArgs, '-p'];
        
        if (useShell) {
          const commandStr = `${command} ${args.join(' ')}`;
          this.activeProcess = spawn(commandStr, [], {
            cwd: options.cwd,
            env: options.env,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
            windowsHide: true,
          });
        } else {
          this.activeProcess = spawn(command, args, {
            cwd: options.cwd,
            env: options.env,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        }
        
        // Write input to stdin
        if (this.activeProcess.stdin) {
          this.activeProcess.stdin.write(input);
          this.activeProcess.stdin.end();
        }
      } else {
        // Single line: pass as positional argument
        if (useShell) {
          // Escape double quotes for Windows cmd
          const escapedInput = input.replace(/"/g, '""');
          const commandStr = `${command} ${baseArgs.join(' ')} "${escapedInput}"`;
          this.activeProcess = spawn(commandStr, [], {
            cwd: options.cwd,
            env: options.env,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
            windowsHide: true,
          });
        } else {
          const finalArgs = [...baseArgs, input];
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
        reject(error);
      });

      this.activeProcess.on('close', (code: number) => {
        clearTimeout(timeoutId);
        this.activeProcess = null;
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
        });
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
