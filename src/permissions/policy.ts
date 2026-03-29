import { PermissionActionCategory, PermissionMode } from '../types';

const DESTRUCTIVE_PATTERNS = [
  /\b(rm|del|delete|remove|reset|format|drop|wipe|destroy)\b/i,
  /删除|清空|销毁|格式化|重置|覆盖/,
];

const NETWORK_PATTERNS = [
  /\b(http|https|curl|wget|fetch|upload|download|deploy|publish|email|smtp|imap|ssh|scp)\b/i,
  /发送邮件|发邮件|上传|下载|联网|网络|远程|部署|发布|推送到服务器/,
];

const EXECUTE_PATTERNS = [
  /\b(run|execute|exec|start|restart|stop|kill|install|npm|pnpm|yarn|pip|pytest|jest|build|compile|command)\b/i,
  /运行|执行|启动|重启|停止|安装|编译|构建|测试/,
];

const EDIT_PATTERNS = [
  /\b(create|write|edit|modify|change|update|patch|refactor|rename|move|copy|save)\b/i,
  /创建|写入|修改|编辑|更新|重构|重命名|移动|复制|保存/,
];

const READ_PATTERNS = [
  /\b(read|view|show|list|inspect|analyze|explain|summarize|status|cat|grep|rg)\b/i,
  /查看|读取|展示|列出|分析|解释|总结|状态|搜索/,
];

function matchesAny(task: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(task));
}

export function inferPermissionCategory(task: string): PermissionActionCategory {
  const normalizedTask = task.trim();

  if (matchesAny(normalizedTask, DESTRUCTIVE_PATTERNS)) {
    return 'destructive';
  }

  if (matchesAny(normalizedTask, NETWORK_PATTERNS)) {
    return 'network';
  }

  if (matchesAny(normalizedTask, EXECUTE_PATTERNS)) {
    return 'execute';
  }

  if (matchesAny(normalizedTask, EDIT_PATTERNS)) {
    return 'edit';
  }

  if (matchesAny(normalizedTask, READ_PATTERNS)) {
    return 'read';
  }

  return 'other';
}

export function requiresApproval(
  mode: PermissionMode,
  category: PermissionActionCategory
): boolean {
  switch (mode) {
    case 'interactive':
      return category !== 'read';
    case 'acceptEdits':
      return ['execute', 'network', 'destructive', 'other'].includes(category);
    case 'auto':
    case 'plan':
      return false;
  }
}

export function blocksExecution(mode: PermissionMode): boolean {
  return mode === 'plan';
}

export function summarizeApprovalAction(
  task: string,
  category: PermissionActionCategory
): string {
  const normalizedTask = task.replace(/\s+/g, ' ').trim();
  const truncatedTask =
    normalizedTask.length > 120
      ? `${normalizedTask.substring(0, 117)}...`
      : normalizedTask;

  return `[${category}] ${truncatedTask}`;
}
