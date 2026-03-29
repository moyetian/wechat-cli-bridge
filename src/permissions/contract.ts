import {
  PermissionActionCategory,
  PermissionDecision,
  PermissionMode,
} from '../types';

export const DEFAULT_PERMISSION_MODE: PermissionMode = 'auto';
export const DEFAULT_PERMISSION_TIMEOUT_SECONDS = 120;

export const PERMISSION_MODES: PermissionMode[] = [
  'interactive',
  'acceptEdits',
  'auto',
  'plan',
];

export const PERMISSION_MODE_DESCRIPTIONS: Record<PermissionMode, string> = {
  interactive: '每次敏感操作都需手动批准',
  acceptEdits: '自动批准文件编辑，其他敏感操作需批准',
  auto: '自动批准所有操作（危险）',
  plan: '只读模式，只返回执行计划，不启动 Agent',
};

export const PERMISSION_ACTION_CATEGORIES: PermissionActionCategory[] = [
  'read',
  'edit',
  'execute',
  'network',
  'destructive',
  'other',
];

export const PERMISSION_DECISIONS: PermissionDecision[] = [
  'pending',
  'approved',
  'denied',
  'expired',
];

export function isValidPermissionMode(mode: string): mode is PermissionMode {
  return PERMISSION_MODES.includes(mode as PermissionMode);
}

export function normalizePermissionMode(
  mode: unknown,
  fallback: PermissionMode = DEFAULT_PERMISSION_MODE
): PermissionMode {
  return typeof mode === 'string' && isValidPermissionMode(mode) ? mode : fallback;
}

export function getPermissionModeDescription(mode: PermissionMode): string {
  return PERMISSION_MODE_DESCRIPTIONS[mode];
}

export function isValidPermissionDecision(
  decision: string
): decision is PermissionDecision {
  return PERMISSION_DECISIONS.includes(decision as PermissionDecision);
}

export function isValidPermissionActionCategory(
  category: string
): category is PermissionActionCategory {
  return PERMISSION_ACTION_CATEGORIES.includes(category as PermissionActionCategory);
}
