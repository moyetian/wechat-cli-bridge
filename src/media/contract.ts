import path from 'path';

export type MediaKind = 'image' | 'file';
export type MediaSourceType = 'local_path' | 'remote_url' | 'staged_upload';
export type MediaSendIntent = 'wechat_image' | 'wechat_file' | 'mail_attachment';
export type MediaLifecycleStatus =
  | 'discovered'
  | 'validated'
  | 'staged'
  | 'uploaded'
  | 'sent'
  | 'failed';

export interface MediaAttachmentDraft {
  kind: MediaKind;
  sourceType: MediaSourceType;
  sendIntent: MediaSendIntent;
  localPath?: string;
  remoteUrl?: string;
  stagedPath?: string;
  displayName: string;
  extension: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  status: MediaLifecycleStatus;
}

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.webp',
  '.svg',
]);

export function inferMediaKindFromPath(filePath: string): MediaKind {
  const extension = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(extension) ? 'image' : 'file';
}

export function inferDefaultSendIntent(kind: MediaKind): MediaSendIntent {
  return kind === 'image' ? 'wechat_image' : 'wechat_file';
}

export function createLocalMediaDraft(
  filePath: string,
  options: {
    sendIntent?: MediaSendIntent;
    displayName?: string;
    mimeType?: string;
    sizeBytes?: number;
  } = {}
): MediaAttachmentDraft {
  const normalizedPath = path.resolve(filePath);
  const kind = inferMediaKindFromPath(normalizedPath);
  const displayName = options.displayName || path.basename(normalizedPath);
  const extension = path.extname(displayName).toLowerCase();

  return {
    kind,
    sourceType: 'local_path',
    sendIntent: options.sendIntent || inferDefaultSendIntent(kind),
    localPath: normalizedPath,
    displayName,
    extension,
    mimeType: options.mimeType,
    sizeBytes: options.sizeBytes,
    status: 'discovered',
  };
}

export function supportsSendIntent(
  kind: MediaKind,
  intent: MediaSendIntent
): boolean {
  switch (intent) {
    case 'wechat_image':
      return kind === 'image';
    case 'wechat_file':
    case 'mail_attachment':
      return true;
  }
}

export function summarizeMediaDraft(draft: MediaAttachmentDraft): string {
  const sizeSuffix =
    typeof draft.sizeBytes === 'number' ? `, ${draft.sizeBytes} bytes` : '';
  return `${draft.sendIntent}: ${draft.displayName} (${draft.kind}${sizeSuffix})`;
}
