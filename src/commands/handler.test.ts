import {
  parseMessage,
  isValidPermissionMode,
  getPermissionModeDescription,
  COMMANDS,
  generateHelpText,
} from './handler';

describe('parseMessage', () => {
  describe('commands', () => {
    it('should parse /help command', () => {
      const result = parseMessage('/help');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('help');
    });

    it('should parse /status command', () => {
      const result = parseMessage('/status');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('status');
    });

    it('should parse /clear command', () => {
      const result = parseMessage('/clear');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('clear');
    });

    it('should parse /cd with argument', () => {
      const result = parseMessage('/cd /home/user/project');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('cd');
      expect(result.args).toEqual(['/home/user/project']);
    });

    it('should parse /permission with mode', () => {
      const result = parseMessage('/permission auto');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('permission');
      expect(result.args).toEqual(['auto']);
    });

    it('should parse /sendfile with a path', () => {
      const result = parseMessage('/sendfile ./tmp/report.pdf');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('sendfile');
      expect(result.args).toEqual(['./tmp/report.pdf']);
    });

    it('should parse quoted command arguments with spaces', () => {
      const result = parseMessage('/sendimage "./tmp/my photo.png"');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('sendimage');
      expect(result.args).toEqual(['./tmp/my photo.png']);
    });

    it('should parse /pending command', () => {
      const result = parseMessage('/pending');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('pending');
    });

    it('should parse /mail with pipe-delimited arguments', () => {
      const result = parseMessage('/mail user@example.com | Hello | Body');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('mail');
      expect(result.args).toEqual(['user@example.com', '|', 'Hello', '|', 'Body']);
    });

    it('should parse /approve with request id', () => {
      const result = parseMessage('/approve 1234abcd');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('approve');
      expect(result.args).toEqual(['1234abcd']);
    });

    it('should parse /recover with job id', () => {
      const result = parseMessage('/recover abcd1234');
      expect(result.isCommand).toBe(true);
      expect(result.command).toBe('recover');
      expect(result.args).toEqual(['abcd1234']);
    });
  });

  describe('agent aliases', () => {
    it('should parse iflow task', () => {
      const result = parseMessage('/iflow create a hello world program');
      expect(result.isCommand).toBe(false);
      expect(result.targetAgent).toBe('iflow');
      expect(result.task).toBe('create a hello world program');
    });

    it('should parse claude task', () => {
      const result = parseMessage('/claude fix the bug in app.ts');
      expect(result.isCommand).toBe(false);
      expect(result.targetAgent).toBe('claude');
      expect(result.task).toBe('fix the bug in app.ts');
    });

    it('should parse codex task', () => {
      const result = parseMessage('/codex implement user authentication');
      expect(result.isCommand).toBe(false);
      expect(result.targetAgent).toBe('codex');
      expect(result.task).toBe('implement user authentication');
    });

    it('should parse gemini task', () => {
      const result = parseMessage('/gemini analyze the codebase');
      expect(result.isCommand).toBe(false);
      expect(result.targetAgent).toBe('gemini');
      expect(result.task).toBe('analyze the codebase');
    });
  });

  describe('regular tasks', () => {
    it('should parse regular task without prefix', () => {
      const result = parseMessage('create a new file called test.txt');
      expect(result.isCommand).toBe(false);
      expect(result.task).toBe('create a new file called test.txt');
      expect(result.targetAgent).toBeUndefined();
    });

    it('should handle multiline task', () => {
      const task = 'create a file\nwith multiple\nlines';
      const result = parseMessage(task);
      expect(result.isCommand).toBe(false);
      expect(result.task).toBe(task);
    });

    it('should trim whitespace from task', () => {
      const result = parseMessage('  hello world  ');
      expect(result.isCommand).toBe(false);
      expect(result.task).toBe('hello world');
    });
  });

  describe('unknown commands', () => {
    it('should treat unknown command as task', () => {
      const result = parseMessage('/unknowncommand some text');
      expect(result.isCommand).toBe(false);
      expect(result.task).toBe('/unknowncommand some text');
    });
  });
});

describe('isValidPermissionMode', () => {
  it('should return true for valid modes', () => {
    expect(isValidPermissionMode('interactive')).toBe(true);
    expect(isValidPermissionMode('acceptEdits')).toBe(true);
    expect(isValidPermissionMode('auto')).toBe(true);
    expect(isValidPermissionMode('plan')).toBe(true);
  });

  it('should return false for invalid modes', () => {
    expect(isValidPermissionMode('invalid')).toBe(false);
    expect(isValidPermissionMode('')).toBe(false);
    expect(isValidPermissionMode('AUTO')).toBe(false);
  });
});

describe('getPermissionModeDescription', () => {
  it('should return description for each mode', () => {
    expect(getPermissionModeDescription('interactive')).toContain('手动批准');
    expect(getPermissionModeDescription('acceptEdits')).toContain('自动批准文件编辑');
    expect(getPermissionModeDescription('auto')).toContain('自动批准所有操作');
    expect(getPermissionModeDescription('plan')).toContain('只读模式');
  });
});

describe('COMMANDS', () => {
  it('should have all required commands', () => {
    expect(COMMANDS.help).toBeDefined();
    expect(COMMANDS.status).toBeDefined();
    expect(COMMANDS.clear).toBeDefined();
    expect(COMMANDS.cancel).toBeDefined();
    expect(COMMANDS.cd).toBeDefined();
    expect(COMMANDS.sendfile).toBeDefined();
    expect(COMMANDS.sendimage).toBeDefined();
    expect(COMMANDS.mail).toBeDefined();
    expect(COMMANDS.mailhtml).toBeDefined();
    expect(COMMANDS.mailfile).toBeDefined();
    expect(COMMANDS.permission).toBeDefined();
    expect(COMMANDS.pending).toBeDefined();
    expect(COMMANDS.approve).toBeDefined();
    expect(COMMANDS.deny).toBeDefined();
    expect(COMMANDS.recover).toBeDefined();
  });

  it('should have correct command info', () => {
    expect(COMMANDS.cd.requiresArg).toBe(true);
    expect(COMMANDS.cd.argHint).toBe('<path>');
    expect(COMMANDS.status.requiresArg).toBe(false);
  });
});

describe('generateHelpText', () => {
  it('should reflect configured media size limits', () => {
    const helpText = generateHelpText({
      maxImageSizeMB: 20,
      maxFileSizeMB: 50,
    });

    expect(helpText).toContain('图片当前限制: 20 MB');
    expect(helpText).toContain('文件当前限制: 50 MB');
    expect(helpText).toContain('/mail to@example.com | Subject | Body');
    expect(helpText).toContain('/recover [jobId]: 重试失败的 research run');
  });
});
