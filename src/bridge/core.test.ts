import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Bridge } from './core';
import { ContextManager } from '../context/manager';
import { initStorage, resetStorageForTests } from '../utils/storage';
import { resetLoggerForTests } from '../utils/logger';
import { BridgeConfig, ExecuteResult, WeChatMessage } from '../types';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-core-test',
  Date.now().toString()
);

function createConfig(mode: BridgeConfig['permission']['mode']): BridgeConfig {
  return {
    defaultAgent: 'codex',
    workingDirectory: '/tmp/project',
    agents: {},
    context: {
      maxHistory: 50,
      summarizeThreshold: 20000,
      stateFile: true,
    },
    permission: {
      mode,
      timeout: 120,
    },
    media: {
      maxImageSizeMB: 10,
      maxFileSizeMB: 25,
    },
    mail: {
      enabled: true,
      provider: 'smtp',
      from: 'bot@example.com',
      replyTo: 'reply@example.com',
      defaultTo: [],
      maxAttachmentSizeMB: 25,
      smtp: {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        user: 'bot@example.com',
        pass: 'secret',
      },
    },
    ilink: {
      pollInterval: 30000,
      timeout: 30000,
    },
  };
}

function createMessage(text: string): WeChatMessage {
  return {
    id: `msg-${Date.now()}`,
    from: 'user-1',
    text,
    type: 'text',
    timestamp: new Date(),
    contextToken: 'ctx-1',
  };
}

describe('Bridge approval flow', () => {
  let manager: ContextManager;

  beforeEach(() => {
    initStorage(TEST_DIR);
    manager = new ContextManager();
  });

  afterEach(async () => {
    resetStorageForTests();
    resetLoggerForTests();
    jest.restoreAllMocks();
    await fs.remove(TEST_DIR);
  });

  function createBridgeHarness(mode: BridgeConfig['permission']['mode']) {
    const bridge = new Bridge(createConfig(mode), {
      token: 'token',
      accountId: 'account',
      baseUrl: 'https://example.com',
    }) as any;

    const execute = jest.fn<Promise<ExecuteResult>, any[]>(async () => ({
      success: true,
      output: 'done',
      summary: '任务完成',
      filesModified: [],
    }));

    bridge.contextManager = manager;
    bridge.agents = {
      get: jest.fn(() => ({ execute })),
      has: jest.fn(() => true),
      list: jest.fn(() => ['codex']),
      getAvailable: jest.fn(async () => ['codex']),
    };
    bridge.ilink = {
      reply: jest.fn(async () => true),
      sendMarkdown: jest.fn(async () => true),
      requestPermission: jest.fn(async () => true),
      sendLocalMedia: jest.fn(async (_to: string, filePath: string, options?: { mode?: 'image' | 'file' }) => ({
        success: true,
        transportKind: options?.mode || 'file',
        displayName: path.basename(filePath),
        resolvedPath: filePath,
      })),
      stop: jest.fn(),
      poll: jest.fn(),
    };
    bridge.mailSender = {
      send: jest.fn(async () => ({
        success: true,
        accepted: ['user@example.com'],
        rejected: [],
        messageId: 'mail-1',
        summary: '邮件已发送',
      })),
    };

    return {
      bridge,
      execute,
      ilink: bridge.ilink,
      mailSender: bridge.mailSender,
    };
  }

  it('should create approval request instead of executing immediately in interactive mode', async () => {
    const { bridge, execute, ilink } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));

    expect(ilink.requestPermission).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.approvalRequests).toHaveLength(1);
    expect(context.state.approvalRequests[0].status).toBe('pending');
    expect(context.state.pendingExecutions).toHaveLength(1);
    expect(context.state.pendingExecutions[0].status).toBe('awaiting_approval');
  });

  it('should resume approved execution', async () => {
    const { bridge, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));
    await bridge.handleMessage(createMessage('/approve'));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      '修改 src/app.ts 的登录逻辑',
      expect.objectContaining({
        workingDir: '/tmp/project',
      })
    );

    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(context.state.approvalRequests[0].status).toBe('approved');
    expect(context.state.pendingExecutions[0].status).toBe('completed');
  });

  it('should block new tasks while approval is pending', async () => {
    const { bridge, execute, ilink } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));
    await bridge.handleMessage(createMessage('再改一下 src/auth.ts'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('当前有任务待审批')
    );
  });

  it('should expire overdue approvals before approval shortcut is handled', async () => {
    const { bridge, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));
    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    context.state.approvalRequests[0].expiresAt = new Date(Date.now() - 1000);
    context.lastActivity = new Date();
    await manager.save(context);

    await bridge.handleMessage(createMessage('y'));

    expect(execute).not.toHaveBeenCalled();

    const reloaded = await manager.load('user-1', { permissionMode: 'interactive' });
    expect(reloaded.state.approvalRequests[0].status).toBe('expired');
    expect(reloaded.state.pendingExecutions[0].status).toBe('expired');
  });

  it('should not execute tasks in plan mode', async () => {
    const { bridge, execute, ilink } = createBridgeHarness('plan');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('plan 模式')
    );
  });

  it('should resolve and send a local file via /sendfile command', async () => {
    const { bridge, ilink } = createBridgeHarness('interactive');
    const filePath = path.join(TEST_DIR, 'report.txt');
    await fs.writeFile(filePath, 'hello', 'utf8');

    await bridge.handleMessage(createMessage(`/sendfile ${filePath}`));

    expect(ilink.sendLocalMedia).toHaveBeenCalledWith(
      'user-1',
      filePath,
      expect.objectContaining({
        contextToken: 'ctx-1',
        mode: 'file',
      })
    );
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('文件已发送')
    );
  });

  it('should resolve and send a local image via /sendimage command', async () => {
    const { bridge, ilink } = createBridgeHarness('interactive');
    const imagePath = path.join(TEST_DIR, 'photo.png');
    await fs.writeFile(imagePath, 'hello', 'utf8');

    await bridge.handleMessage(createMessage(`/sendimage "${imagePath}"`));

    expect(ilink.sendLocalMedia).toHaveBeenCalledWith(
      'user-1',
      imagePath,
      expect.objectContaining({
        contextToken: 'ctx-1',
        mode: 'image',
      })
    );
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('图片已发送')
    );
  });

  it('should resolve a natural language file-send request without invoking an agent', async () => {
    const { bridge, ilink, execute } = createBridgeHarness('interactive');
    const filePath = path.join(TEST_DIR, 'report.txt');
    await fs.writeFile(filePath, 'hello', 'utf8');

    await bridge.handleMessage(createMessage(`把 "${filePath}" 发给我`));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.sendLocalMedia).toHaveBeenCalledWith(
      'user-1',
      filePath,
      expect.objectContaining({
        contextToken: 'ctx-1',
        mode: 'file',
      })
    );
  });

  it('should ask for clarification on vague natural language media requests', async () => {
    const { bridge, ilink, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('把桌面上的某个文件发给我'));

    expect(execute).not.toHaveBeenCalled();
    expect(ilink.sendLocalMedia).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('还没说具体文件名')
    );
  });

  it('should send a text mail via /mail command', async () => {
    const { bridge, mailSender, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(
      createMessage('/mail user@example.com | Hello | This is a test')
    );

    expect(execute).not.toHaveBeenCalled();
    expect(mailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Hello',
        textBody: 'This is a test',
      })
    );
  });

  it('should send html mail with a plain-text fallback via /mailhtml command', async () => {
    const { bridge, mailSender } = createBridgeHarness('interactive');

    await bridge.handleMessage(
      createMessage('/mailhtml user@example.com | Hello HTML | <p><b>Hello</b> world</p>')
    );

    expect(mailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Hello HTML',
        htmlBody: '<p><b>Hello</b> world</p>',
        textBody: 'Hello world',
        bodyFormat: 'multipart',
      })
    );
  });

  it('should send an attachment mail via /mailfile command', async () => {
    const { bridge, mailSender } = createBridgeHarness('interactive');
    const filePath = path.join(TEST_DIR, 'report.txt');
    await fs.writeFile(filePath, 'hello', 'utf8');

    await bridge.handleMessage(
      createMessage(`/mailfile user@example.com | Report | ${filePath} | Please review`)
    );

    expect(mailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Report',
        attachments: [
          expect.objectContaining({
            inline: false,
            attachment: expect.objectContaining({
              displayName: 'report.txt',
            }),
          }),
        ],
      })
    );
  });

  it('should surface the resolved path when /mailfile attachment preparation fails', async () => {
    const { bridge, ilink, mailSender } = createBridgeHarness('interactive');

    await bridge.handleMessage(
      createMessage('/mailfile user@example.com | Report | ./missing-file.txt | Please review')
    );

    expect(mailSender.send).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('解析路径: /tmp/project/missing-file.txt')
    );
  });

  it('should reject invalid recipient addresses in /mail command', async () => {
    const { bridge, ilink, mailSender } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('/mail invalid-address | Hi | Body'));

    expect(mailSender.send).not.toHaveBeenCalled();
    expect(ilink.reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('收件人地址无效')
    );
  });

  it('should surface typed media send failures', async () => {
    const { bridge, ilink } = createBridgeHarness('interactive');
    (ilink.sendLocalMedia as jest.Mock).mockResolvedValueOnce({
      success: false,
      code: 'PROTECTED_PATH',
      message: '禁止发送敏感路径: .ssh',
    });

    await bridge.handleMessage(createMessage('/sendfile ~/.ssh/id_rsa'));

    const replyCalls = (ilink.reply as jest.Mock).mock.calls;
    const lastReply = replyCalls[replyCalls.length - 1];
    expect(lastReply?.[1]).toContain('禁止发送该路径');
  });

  it('should resume already-approved pending task even if current mode was changed to plan', async () => {
    const { bridge, execute } = createBridgeHarness('interactive');

    await bridge.handleMessage(createMessage('修改 src/app.ts 的登录逻辑'));
    const context = await manager.load('user-1', { permissionMode: 'interactive' });
    context.permissionMode = 'plan';
    context.lastActivity = new Date();
    await manager.save(context);

    await bridge.handleMessage(createMessage('/approve'));

    expect(execute).toHaveBeenCalledTimes(1);
  });
});
