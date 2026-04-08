import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface PreviewPublishConfig {
  baseUrl: string;
  syncTarget: string;
  sshKeyPath?: string;
  knownHostsPath: string;
}

export interface PreviewPublishResult {
  status: 'published' | 'skipped' | 'failed';
  publicUrl?: string;
  error?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parseSyncTarget(syncTarget: string): { host: string; remoteBasePath: string } | null {
  const match = syncTarget.match(/^([^:]+):(.+)$/);
  if (!match) {
    return null;
  }

  return {
    host: match[1],
    remoteBasePath: match[2],
  };
}

export function buildArticlePreviewPublicUrl(baseUrl: string, jobId: string): string {
  return `${normalizeBaseUrl(baseUrl)}/${encodeURIComponent(jobId)}/`;
}

export function resolvePreviewPublishConfig(
  env: NodeJS.ProcessEnv = process.env
): PreviewPublishConfig | null {
  const baseUrl = env.WECHAT_CLI_BRIDGE_PREVIEW_BASE_URL?.trim();
  const syncTarget = env.WECHAT_CLI_BRIDGE_PREVIEW_SYNC_TARGET?.trim();
  const sshKeyPath = env.WECHAT_CLI_BRIDGE_PREVIEW_SYNC_KEY_PATH?.trim();

  if (!baseUrl || !syncTarget) {
    return null;
  }

  return {
    baseUrl,
    syncTarget,
    sshKeyPath: sshKeyPath || undefined,
    knownHostsPath:
      env.WECHAT_CLI_BRIDGE_PREVIEW_KNOWN_HOSTS?.trim() ||
      path.join(os.tmpdir(), 'wechat-cli-bridge-preview-known_hosts'),
  };
}

export async function publishArticlePreview(options: {
  jobId: string;
  localPreviewPath: string;
  config?: PreviewPublishConfig | null;
}): Promise<PreviewPublishResult> {
  const config = options.config ?? resolvePreviewPublishConfig();
  if (!config) {
    return { status: 'skipped' };
  }

  const parsedTarget = parseSyncTarget(config.syncTarget);
  if (!parsedTarget) {
    return {
      status: 'failed',
      error: `Invalid preview sync target: ${config.syncTarget}`,
    };
  }

  if (!(await fs.pathExists(options.localPreviewPath))) {
    return {
      status: 'failed',
      error: `Preview file not found: ${options.localPreviewPath}`,
    };
  }

  await fs.ensureFile(config.knownHostsPath);
  const remoteDir = `${parsedTarget.remoteBasePath.replace(/\/+$/, '')}/${options.jobId}`;
  const remoteFile = `${remoteDir}/index.html`;
  const sshArgs = [
    ...(config.sshKeyPath ? ['-i', config.sshKeyPath] : []),
    '-o',
    `UserKnownHostsFile=${config.knownHostsPath}`,
    '-o',
    'StrictHostKeyChecking=accept-new',
  ];

  try {
    await execFileAsync('ssh', [
      ...sshArgs,
      parsedTarget.host,
      `mkdir -p ${shellEscape(remoteDir)}`,
    ]);
    await execFileAsync('scp', [
      ...sshArgs,
      options.localPreviewPath,
      `${parsedTarget.host}:${remoteFile}`,
    ]);

    return {
      status: 'published',
      publicUrl: buildArticlePreviewPublicUrl(config.baseUrl, options.jobId),
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
