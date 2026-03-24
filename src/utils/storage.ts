import path from 'path';
import fs from 'fs-extra';
import os from 'os';

const BRIDGE_DIR = path.join(os.homedir(), '.wechat-cli-bridge');

export class Storage {
  private baseDir: string;

  constructor(baseDir: string = BRIDGE_DIR) {
    this.baseDir = baseDir;
    this.ensureDirs();
  }

  private ensureDirs(): void {
    const dirs = [
      this.baseDir,
      this.accountsDir,
      this.sessionsDir,
      this.projectsDir,
      this.logsDir,
    ];
    dirs.forEach(dir => fs.ensureDirSync(dir));
  }

  // Directory paths
  get accountsDir() { return path.join(this.baseDir, 'accounts'); }
  get sessionsDir() { return path.join(this.baseDir, 'sessions'); }
  get projectsDir() { return path.join(this.baseDir, 'projects'); }
  get logsDir() { return path.join(this.baseDir, 'logs'); }

  // Config
  async getConfig(): Promise<Record<string, unknown>> {
    const configPath = path.join(this.baseDir, 'config.json');
    if (await fs.pathExists(configPath)) {
      return fs.readJson(configPath);
    }
    return {};
  }

  async setConfig(config: Record<string, unknown>): Promise<void> {
    const configPath = path.join(this.baseDir, 'config.json');
    await fs.writeJson(configPath, config, { spaces: 2 });
  }

  // Account
  async getAccount(userId: string): Promise<Record<string, unknown> | null> {
    const accountPath = path.join(this.accountsDir, `${userId}.json`);
    if (await fs.pathExists(accountPath)) {
      return fs.readJson(accountPath);
    }
    return null;
  }

  async setAccount(userId: string, data: Record<string, unknown>): Promise<void> {
    const accountPath = path.join(this.accountsDir, `${userId}.json`);
    await fs.writeJson(accountPath, data, { spaces: 2 });
  }

  async removeAccount(userId: string): Promise<void> {
    const accountPath = path.join(this.accountsDir, `${userId}.json`);
    await fs.remove(accountPath);
  }

  // Session
  async getSession(userId: string): Promise<Record<string, unknown> | null> {
    const sessionPath = path.join(this.sessionsDir, userId, 'session.json');
    if (await fs.pathExists(sessionPath)) {
      return fs.readJson(sessionPath);
    }
    return null;
  }

  async setSession(userId: string, data: Record<string, unknown>): Promise<void> {
    const sessionDir = path.join(this.sessionsDir, userId);
    await fs.ensureDir(sessionDir);
    const sessionPath = path.join(sessionDir, 'session.json');
    await fs.writeJson(sessionPath, data, { spaces: 2 });
  }

  // State files (GSD style)
  async getStateFile(userId: string, filename: string): Promise<string | null> {
    const filePath = path.join(this.sessionsDir, userId, filename);
    if (await fs.pathExists(filePath)) {
      return fs.readFile(filePath, 'utf-8');
    }
    return null;
  }

  async setStateFile(userId: string, filename: string, content: string): Promise<void> {
    const sessionDir = path.join(this.sessionsDir, userId);
    await fs.ensureDir(sessionDir);
    const filePath = path.join(sessionDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  // Project
  async getProject(name: string): Promise<Record<string, unknown> | null> {
    const projectPath = path.join(this.projectsDir, name, 'project.json');
    if (await fs.pathExists(projectPath)) {
      return fs.readJson(projectPath);
    }
    return null;
  }

  async setProject(name: string, data: Record<string, unknown>): Promise<void> {
    const projectDir = path.join(this.projectsDir, name);
    await fs.ensureDir(projectDir);
    const projectPath = path.join(projectDir, 'project.json');
    await fs.writeJson(projectPath, data, { spaces: 2 });
  }

  // Cleanup
  async clearSession(userId: string): Promise<void> {
    const sessionDir = path.join(this.sessionsDir, userId);
    await fs.remove(sessionDir);
  }

  async clearAllSessions(): Promise<void> {
    await fs.emptyDir(this.sessionsDir);
  }
}

export const storage = new Storage();
export default storage;
