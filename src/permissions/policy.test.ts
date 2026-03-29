import { blocksExecution, inferPermissionCategory, requiresApproval, summarizeApprovalAction } from './policy';

describe('permission policy', () => {
  it('should classify read-only tasks', () => {
    expect(inferPermissionCategory('查看 src/index.ts 的内容')).toBe('read');
    expect(inferPermissionCategory('analyze this codebase')).toBe('read');
  });

  it('should classify edit tasks', () => {
    expect(inferPermissionCategory('修改 src/app.ts 中的 bug')).toBe('edit');
    expect(inferPermissionCategory('create a new README section')).toBe('edit');
  });

  it('should classify execute tasks', () => {
    expect(inferPermissionCategory('运行 npm test 并修复失败')).toBe('execute');
    expect(inferPermissionCategory('build the project')).toBe('execute');
  });

  it('should classify network and destructive tasks with higher priority', () => {
    expect(inferPermissionCategory('发送邮件给我并附上日志')).toBe('network');
    expect(inferPermissionCategory('删除 dist 目录并重新构建')).toBe('destructive');
  });

  it('should determine approval requirement by mode', () => {
    expect(requiresApproval('interactive', 'read')).toBe(false);
    expect(requiresApproval('interactive', 'edit')).toBe(true);
    expect(requiresApproval('acceptEdits', 'edit')).toBe(false);
    expect(requiresApproval('acceptEdits', 'network')).toBe(true);
    expect(requiresApproval('auto', 'destructive')).toBe(false);
  });

  it('should block execution in plan mode only', () => {
    expect(blocksExecution('plan')).toBe(true);
    expect(blocksExecution('interactive')).toBe(false);
  });

  it('should summarize approval actions concisely', () => {
    expect(summarizeApprovalAction('修改 src/app.ts 的登录逻辑', 'edit')).toContain('[edit]');
  });
});
