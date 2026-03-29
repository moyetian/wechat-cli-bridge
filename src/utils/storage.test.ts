import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Storage } from './storage';

// Use temp directory for tests
const TEST_DIR = path.join(os.tmpdir(), 'wechat-cli-bridge-test', Date.now().toString());

describe('Storage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage(TEST_DIR);
    storage.ensureReadySync();
  });

  afterEach(async () => {
    await fs.remove(TEST_DIR);
  });

  describe('directories', () => {
    it('should create base directory', () => {
      expect(fs.pathExistsSync(TEST_DIR)).toBe(true);
    });

    it('should create subdirectories', () => {
      expect(fs.pathExistsSync(storage.accountsDir)).toBe(true);
      expect(fs.pathExistsSync(storage.sessionsDir)).toBe(true);
      expect(fs.pathExistsSync(storage.projectsDir)).toBe(true);
      expect(fs.pathExistsSync(storage.logsDir)).toBe(true);
      expect(fs.pathExistsSync(storage.attachmentsDir)).toBe(true);
    });
  });

  describe('config', () => {
    it('should return empty object when config does not exist', async () => {
      const config = await storage.getConfig();
      expect(config).toEqual({});
    });

    it('should save and retrieve config', async () => {
      await storage.setConfig({ key: 'value', nested: { foo: 'bar' } });
      const config = await storage.getConfig();
      expect(config.key).toBe('value');
      expect(config.nested).toEqual({ foo: 'bar' });
    });
  });

  describe('account', () => {
    it('should return null when account does not exist', async () => {
      const account = await storage.getAccount('nonexistent');
      expect(account).toBeNull();
    });

    it('should save and retrieve account', async () => {
      await storage.setAccount('user123', { name: 'Test User', token: 'abc123' });
      const account = await storage.getAccount('user123');
      expect(account).not.toBeNull();
      expect(account?.name).toBe('Test User');
      expect(account?.token).toBe('abc123');
    });

    it('should remove account', async () => {
      await storage.setAccount('user456', { name: 'Test' });
      await storage.removeAccount('user456');
      const account = await storage.getAccount('user456');
      expect(account).toBeNull();
    });
  });

  describe('session', () => {
    it('should return null when session does not exist', async () => {
      const session = await storage.getSession('nonexistent');
      expect(session).toBeNull();
    });

    it('should save and retrieve session', async () => {
      await storage.setSession('user123', {
        sessionId: 'sess-123',
        defaultAgent: 'iflow',
        workingDir: '/home/user/project',
      });
      const session = await storage.getSession('user123');
      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe('sess-123');
      expect(session?.defaultAgent).toBe('iflow');
    });
  });

  describe('state files', () => {
    it('should return null when state file does not exist', async () => {
      const content = await storage.getStateFile('user123', 'STATE.md');
      expect(content).toBeNull();
    });

    it('should save and retrieve state file', async () => {
      const content = '# State\n\n## Tasks\n- Task 1\n- Task 2';
      await storage.setStateFile('user123', 'STATE.md', content);
      const retrieved = await storage.getStateFile('user123', 'STATE.md');
      expect(retrieved).toBe(content);
    });
  });

  describe('project', () => {
    it('should return null when project does not exist', async () => {
      const project = await storage.getProject('nonexistent');
      expect(project).toBeNull();
    });

    it('should save and retrieve project', async () => {
      await storage.setProject('my-project', {
        name: 'my-project',
        root: '/home/user/my-project',
        techStack: ['typescript', 'node'],
      });
      const project = await storage.getProject('my-project');
      expect(project).not.toBeNull();
      expect(project?.name).toBe('my-project');
      expect(project?.techStack).toEqual(['typescript', 'node']);
    });
  });

  describe('cleanup', () => {
    it('should clear session', async () => {
      await storage.setSession('user789', { sessionId: 'sess-789' });
      await storage.setStateFile('user789', 'STATE.md', '# State');
      await storage.clearSession('user789');
      
      const session = await storage.getSession('user789');
      const state = await storage.getStateFile('user789', 'STATE.md');
      
      expect(session).toBeNull();
      expect(state).toBeNull();
    });

    it('should clear all sessions', async () => {
      await storage.setSession('user1', { sessionId: 'sess-1' });
      await storage.setSession('user2', { sessionId: 'sess-2' });
      
      await storage.clearAllSessions();
      
      expect(await storage.getSession('user1')).toBeNull();
      expect(await storage.getSession('user2')).toBeNull();
    });
  });
});
