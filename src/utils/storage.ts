import path from 'path';
import fs from 'fs-extra';
import { getBridgePaths } from './paths';

export class Storage {
  private baseDir: string;

  constructor(baseDir: string = getBridgePaths().homeDir) {
    this.baseDir = baseDir;
  }

  private ensureDirsSync(): void {
    const dirs = [
      this.baseDir,
      this.accountsDir,
      this.sessionsDir,
      this.projectsDir,
      this.logsDir,
      this.attachmentsDir,
    ];
    dirs.forEach(dir => fs.ensureDirSync(dir));
  }

  async ensureReady(): Promise<void> {
    const dirs = [
      this.baseDir,
      this.accountsDir,
      this.sessionsDir,
      this.projectsDir,
      this.logsDir,
      this.attachmentsDir,
    ];

    await Promise.all(dirs.map(dir => fs.ensureDir(dir)));
  }

  ensureReadySync(): void {
    this.ensureDirsSync();
  }

  // Directory paths
  get accountsDir() { return path.join(this.baseDir, 'accounts'); }
  get sessionsDir() { return path.join(this.baseDir, 'sessions'); }
  get projectsDir() { return path.join(this.baseDir, 'projects'); }
  get logsDir() { return path.join(this.baseDir, 'logs'); }
  get attachmentsDir() { return path.join(this.baseDir, 'attachments'); }

  // Config
  async getConfig(): Promise<Record<string, unknown>> {
    const configPath = path.join(this.baseDir, 'config.json');
    if (await fs.pathExists(configPath)) {
      return fs.readJson(configPath);
    }
    return {};
  }

  async setConfig(config: Record<string, unknown>): Promise<void> {
    await this.ensureReady();
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
    await fs.ensureDir(this.accountsDir);
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

let storageInstance: Storage | undefined;

export function initStorage(baseDir?: string): Storage {
  storageInstance = new Storage(baseDir);
  storageInstance.ensureReadySync();
  return storageInstance;
}

export function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = new Storage();
  }

  return storageInstance;
}

export function resetStorageForTests(): void {
  storageInstance = undefined;
}

export const storage = new Proxy({} as Storage, {
  get(_target, property) {
    const instance = getStorage();
    const value = Reflect.get(instance, property);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export default storage;
