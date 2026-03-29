import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';
import {
  createLocalMediaDraft,
  inferMediaKindFromPath,
  MediaAttachmentDraft,
  MediaSendIntent,
} from './contract';
import { getBridgePaths } from '../utils/paths';

export type MediaStagingErrorCode =
  | 'NOT_FOUND'
  | 'NOT_FILE'
  | 'TOO_LARGE'
  | 'STAGING_FAILED'
  | 'PROTECTED_PATH'
  | 'UNSUPPORTED_IMAGE_TYPE';

export type LocalMediaTransportKind = 'auto' | 'image' | 'file';

export const MAX_WECHAT_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_WECHAT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export class MediaStagingError extends Error {
  code: MediaStagingErrorCode;

  constructor(code: MediaStagingErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

const SUPPORTED_WECHAT_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
]);

const PROTECTED_PATH_SEGMENTS = new Set([
  '.git',
  '.ssh',
  '.gnupg',
  '.aws',
]);

const PROTECTED_BASENAME_PATTERNS = [
  /^\.env(?:\..+)?$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^authorized_keys$/i,
  /^known_hosts$/i,
  /^\.npmrc$/i,
  /^\.pypirc$/i,
  /^\.git-credentials$/i,
];

const PROTECTED_ABSOLUTE_PREFIXES = [
  '/proc',
  '/sys',
  '/dev',
  '/run',
  '/var/run',
];

export interface StageLocalMediaOptions {
  bridgeHome?: string;
  sendIntent?: MediaSendIntent;
  maxSizeBytes?: number;
  transportKind?: LocalMediaTransportKind;
}

export function inferMimeType(filePath: string): string | undefined {
  return MIME_TYPES[path.extname(filePath).toLowerCase()];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function detectProtectedPath(normalizedPath: string): string | null {
  const lowerPath = normalizedPath.toLowerCase();

  for (const prefix of PROTECTED_ABSOLUTE_PREFIXES) {
    const lowerPrefix = prefix.toLowerCase();
    if (lowerPath === lowerPrefix || lowerPath.startsWith(`${lowerPrefix}/`)) {
      return prefix;
    }
  }

  const segments = normalizedPath.split(/[\\/]+/).filter(Boolean);
  for (const segment of segments) {
    if (PROTECTED_PATH_SEGMENTS.has(segment.toLowerCase())) {
      return segment;
    }
  }

  const basename = path.basename(normalizedPath);
  for (const pattern of PROTECTED_BASENAME_PATTERNS) {
    if (pattern.test(basename)) {
      return basename;
    }
  }

  return null;
}

function inferEffectiveTransportKind(
  normalizedPath: string,
  transportKind: LocalMediaTransportKind
): 'image' | 'file' {
  if (transportKind === 'auto') {
    return inferMediaKindFromPath(normalizedPath);
  }

  return transportKind;
}

async function computeSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });

  return hash.digest('hex');
}

export async function stageLocalMedia(
  filePath: string,
  options: StageLocalMediaOptions = {}
): Promise<MediaAttachmentDraft> {
  const normalizedPath = path.resolve(filePath);
  const blockedTarget = detectProtectedPath(normalizedPath);
  const requestedTransportKind = options.transportKind || 'auto';
  const effectiveTransportKind = inferEffectiveTransportKind(
    normalizedPath,
    requestedTransportKind
  );

  if (blockedTarget) {
    throw new MediaStagingError(
      'PROTECTED_PATH',
      `禁止发送敏感路径: ${blockedTarget}`
    );
  }

  if (!(await fs.pathExists(normalizedPath))) {
    throw new MediaStagingError('NOT_FOUND', `附件不存在: ${normalizedPath}`);
  }

  const stats = await fs.stat(normalizedPath);
  if (!stats.isFile()) {
    throw new MediaStagingError('NOT_FILE', `附件不是普通文件: ${normalizedPath}`);
  }

  if (effectiveTransportKind === 'image') {
    const extension = path.extname(normalizedPath).toLowerCase();
    if (!SUPPORTED_WECHAT_IMAGE_EXTENSIONS.has(extension)) {
      throw new MediaStagingError(
        'UNSUPPORTED_IMAGE_TYPE',
        `图片发送仅支持 PNG/JPG/JPEG/GIF/WEBP/BMP，当前为 ${extension || '无扩展名'}`
      );
    }
  }

  const maxSizeBytes =
    options.maxSizeBytes ??
    (effectiveTransportKind === 'image'
      ? MAX_WECHAT_IMAGE_SIZE_BYTES
      : MAX_WECHAT_FILE_SIZE_BYTES);

  if (stats.size > maxSizeBytes) {
    throw new MediaStagingError(
      'TOO_LARGE',
      `附件超过限制: ${formatBytes(stats.size)} > ${formatBytes(maxSizeBytes)}`
    );
  }

  const paths = getBridgePaths(options.bridgeHome);
  const extension = path.extname(normalizedPath).toLowerCase();
  const sha256 = await computeSha256(normalizedPath);
  const stagedFilename = `${sha256}${extension}`;
  const stagedPath = path.join(paths.attachmentsDir, stagedFilename);

  try {
    await fs.ensureDir(paths.attachmentsDir);
    await fs.copyFile(normalizedPath, stagedPath);
  } catch (error) {
    throw new MediaStagingError(
      'STAGING_FAILED',
      `附件 staging 失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const draft = createLocalMediaDraft(normalizedPath, {
    sendIntent:
      options.sendIntent ||
      (effectiveTransportKind === 'image' ? 'wechat_image' : 'wechat_file'),
    mimeType: inferMimeType(normalizedPath),
    sizeBytes: stats.size,
  });

  return {
    ...draft,
    sha256,
    stagedPath,
    status: 'staged',
  };
}
