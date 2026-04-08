import logger from '../utils/logger';
import { WeChatMessage, SendMessage } from '../types';
import fs from 'fs-extra';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import {
  LocalMediaTransportKind,
  MediaStagingError,
  MediaStagingErrorCode,
  stageLocalMedia,
} from '../media/staging';

// ── API Constants ───────────────────────────────────────────────────────────

export const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com';
export const DEFAULT_CDN_BASE_URL = 'https://novac2c.cdn.weixin.qq.com/c2c';
const CHANNEL_VERSION = process.env.npm_package_version || '1.5.0';

/** Maximum message length for WeChat (conservative limit) */
const MAX_MESSAGE_LENGTH = 2000;

/** Initial retry delay in ms for exponential backoff */
const INITIAL_RETRY_DELAY = 1000;

/** Maximum retry delay in ms */
const MAX_RETRY_DELAY = 60000;

/** Heartbeat interval in ms */
const HEARTBEAT_INTERVAL = 30000;

/** Maximum retry attempts for CDN upload */
const CDN_UPLOAD_MAX_RETRIES = 3;

// ── Enums ───────────────────────────────────────────────────────────────────

export enum MessageType {
  USER = 1,
  BOT = 2,
}

export enum MessageItemType {
  TEXT = 1,
  IMAGE = 2,
  FILE = 4,
}

export enum MessageState {
  NEW = 0,
  GENERATING = 1,
  FINISH = 2,
}

// ── API Types ───────────────────────────────────────────────────────────────

interface TextItem {
  text: string;
}

interface MessageItem {
  type: MessageItemType;
  text_item?: TextItem;
  image_item?: {
    media?: {
      encrypt_query_param?: string;
      aes_key?: string;
      encrypt_type?: number;
    };
    mid_size?: number;
  };
  file_item?: {
    media?: {
      encrypt_query_param?: string;
      aes_key?: string;
      encrypt_type?: number;
    };
    file_name?: string;
    len?: string;
  };
}

interface WeixinMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  create_time_ms?: number;
  message_type?: MessageType;
  message_state?: MessageState;
  item_list?: MessageItem[];
  context_token?: string;
}

interface GetUpdatesResp {
  ret?: number;
  retmsg?: string;
  sync_buf: string;
  get_updates_buf: string;
  msgs?: WeixinMessage[];
}

interface OutboundMessage {
  from_user_id: string;
  to_user_id: string;
  client_id: string;
  message_type: MessageType;
  message_state: MessageState;
  context_token: string;
  item_list: MessageItem[];
}

interface GetUploadUrlResp {
  upload_param?: string;
  thumb_upload_param?: string;
}

interface UploadedMediaInfo {
  downloadEncryptedQueryParam: string;
  aesKeyHex: string;
  fileSize: number;
  fileSizeCiphertext: number;
}

export type LocalMediaSendMode = LocalMediaTransportKind;
export type LocalMediaSendErrorCode =
  | MediaStagingErrorCode
  | 'UPLOAD_FAILED'
  | 'SEND_FAILED';

export interface LocalMediaSendResult {
  success: boolean;
  transportKind?: 'image' | 'file';
  displayName?: string;
  resolvedPath?: string;
  code?: LocalMediaSendErrorCode;
  message?: string;
}

// ── Helper Functions ────────────────────────────────────────────────────────

function generateUin(): string {
  const buf = randomBytes(4);
  const uint32 = buf.readUInt32BE(0);
  return Buffer.from(String(uint32), 'utf-8').toString('base64');
}

function truncateMessage(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
  if (text.length <= maxLength) {
    return text;
  }
  const truncated = text.substring(0, maxLength - 50);
  const lastNewline = truncated.lastIndexOf('\n');
  if (lastNewline > maxLength * 0.7) {
    return truncated.substring(0, lastNewline) + '\n\n... (消息过长，已截断)';
  }
  return truncated + '\n\n... (消息过长，已截断)';
}

/**
 * Split long message into chunks at newline boundaries
 */
function splitMessage(text: string, maxLength: number = MAX_MESSAGE_LENGTH - 100): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at newline
    const cutPoint = remaining.lastIndexOf('\n', maxLength);
    if (cutPoint > maxLength * 0.5) {
      chunks.push(remaining.substring(0, cutPoint));
      remaining = remaining.substring(cutPoint + 1);
    } else {
      // No good newline, just cut at maxLength
      chunks.push(remaining.substring(0, maxLength));
      remaining = remaining.substring(maxLength);
    }
  }

  return chunks;
}

function aesEcbPaddedSize(plaintextSize: number): number {
  return Math.ceil((plaintextSize + 1) / 16) * 16;
}

function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv('aes-128-ecb', key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause;

    if (cause instanceof Error && cause.message && cause.message !== error.message) {
      return `${error.message}: ${cause.message}`;
    }

    if (typeof cause === 'string' && cause && cause !== error.message) {
      return `${error.message}: ${cause}`;
    }

    return error.message;
  }

  return String(error);
}

function resolveTransportKind(
  requestedMode: LocalMediaSendMode,
  inferredKind: 'image' | 'file'
): 'image' | 'file' {
  if (requestedMode === 'auto') {
    return inferredKind;
  }

  return requestedMode;
}

// ── ILink Client ────────────────────────────────────────────────────────────

/**
 * iLink Bot API Client
 * 
 * WeChat ClawBot's iLink API for bot messaging.
 * API Base: https://ilinkai.weixin.qq.com
 */
export class ILinkClient {
  private token: string;
  private accountId: string;
  private baseUrl: string;
  private uin: string;
  private syncBuf: string = '';
  private running: boolean = false;
  private clientCounter: number = 0;
  
  // Exponential backoff for reconnection
  private retryDelay: number = INITIAL_RETRY_DELAY;
  private consecutiveErrors: number = 0;
  private cdnBaseUrl: string = DEFAULT_CDN_BASE_URL;
  
  // Health tracking
  private lastHeartbeat: Date = new Date();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(token: string, accountId: string, baseUrl: string = DEFAULT_BASE_URL) {
    this.token = token;
    this.accountId = accountId;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.uin = generateUin();
    logger.info(`ILinkClient initialized for account: ${accountId}`);
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      'AuthorizationType': 'ilink_bot_token',
      'X-WECHAT-UIN': generateUin(),
    };
  }

  private withBaseInfo(body: unknown): unknown {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return body;
    }

    return {
      ...body,
      base_info: {
        channel_version: CHANNEL_VERSION,
      },
    };
  }

  private async request<T>(
    path: string,
    body: unknown,
    timeoutMs: number = 15000
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = `${this.baseUrl}/${path}`;

    logger.debug('API request', { url, body: JSON.stringify(body).substring(0, 200) });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.withBaseInfo(body)),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const json = (await res.json()) as T;
      logger.debug('API response', JSON.stringify(json).substring(0, 200));
      return json;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Start long-polling for messages
   */
  async *poll(): AsyncGenerator<WeChatMessage[], void, unknown> {
    this.running = true;
    this.lastHeartbeat = new Date();
    this.startHeartbeat();
    logger.info('Started polling for messages...');

    while (this.running) {
      try {
        const messages = await this.getUpdates();
        
        // Success - reset exponential backoff
        this.retryDelay = INITIAL_RETRY_DELAY;
        this.consecutiveErrors = 0;
        this.lastHeartbeat = new Date();
        
        if (messages.length > 0) {
          yield messages;
        }
      } catch (error) {
        this.consecutiveErrors++;
        
        // Exponential backoff
        const delay = Math.min(this.retryDelay * Math.pow(2, this.consecutiveErrors - 1), MAX_RETRY_DELAY);
        
        logger.error(`Polling error (attempt ${this.consecutiveErrors}):`, error);
        logger.info(`Retrying in ${delay / 1000}s with exponential backoff...`);
        
        await this.sleep(delay);
      }
    }
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.running = false;
    this.stopHeartbeat();
    logger.info('Stopped polling');
  }

  /**
   * Get updates via long-polling
   */
  private async getUpdates(): Promise<WeChatMessage[]> {
    const body = this.syncBuf ? { get_updates_buf: this.syncBuf } : {};
    
    const resp = await this.request<GetUpdatesResp>(
      'ilink/bot/getupdates',
      body,
      35000 // 35s for long-polling
    );

    // Update sync buffer
    if (resp.get_updates_buf) {
      this.syncBuf = resp.get_updates_buf;
    }

    // Check for errors
    if (resp.ret !== undefined && resp.ret !== 0) {
      throw new Error(`iLink API error: ${resp.retmsg || resp.ret}`);
    }

    // Parse messages
    const msgs = resp.msgs || [];
    if (msgs.length > 0) {
      return msgs.map(this.parseMessage).filter(Boolean) as WeChatMessage[];
    }

    return [];
  }

  /**
   * Parse raw message to WeChatMessage
   */
  private parseMessage(msg: WeixinMessage): WeChatMessage | null {
    try {
      const fromUserId = msg.from_user_id || '';
      const contextToken = msg.context_token || '';

      // Get text from item_list
      let text = '';
      const items = msg.item_list || [];
      for (const item of items) {
        if (item.type === MessageItemType.TEXT && item.text_item) {
          text += item.text_item.text || '';
        }
      }

      return {
        id: String(msg.message_id || msg.seq || Date.now()),
        from: fromUserId,
        text,
        type: 'text',
        timestamp: new Date(msg.create_time_ms || Date.now()),
        contextToken,
      };
    } catch (error) {
      logger.error('Failed to parse message:', error);
      return null;
    }
  }

  /**
   * Generate client ID for message
   */
  private generateClientId(): string {
    return `wcc-${Date.now()}-${++this.clientCounter}`;
  }

  /**
   * Send a text message
   */
  async send(message: SendMessage): Promise<boolean> {
    try {
      const truncatedText = truncateMessage(message.text);
      const clientId = this.generateClientId();

      const msg: OutboundMessage = {
        from_user_id: '',
        to_user_id: message.to,
        client_id: clientId,
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        context_token: message.contextToken || '',
        item_list: [
          {
            type: MessageItemType.TEXT,
            text_item: { text: truncatedText },
          },
        ],
      };

      logger.info('Sending message', { to: message.to, clientId, textLength: truncatedText.length });

      await this.request<void>('ilink/bot/sendmessage', { msg });

      logger.info('Message sent', { to: message.to, clientId });
      return true;
    } catch (error) {
      logger.error('Send message error:', error);
      return false;
    }
  }

  async sendLocalMedia(
    to: string,
    filePath: string,
    options: {
      text?: string;
      contextToken?: string;
      bridgeHome?: string;
      mode?: LocalMediaSendMode;
      maxSizeBytes?: number;
    } = {}
  ): Promise<LocalMediaSendResult> {
    const requestedMode = options.mode || 'auto';
    let draft: Awaited<ReturnType<typeof stageLocalMedia>>;

    try {
      draft = await stageLocalMedia(filePath, {
        bridgeHome: options.bridgeHome,
        transportKind: requestedMode,
        maxSizeBytes: options.maxSizeBytes,
      });
    } catch (error) {
      logger.error('Send local media error:', error);

      if (error instanceof MediaStagingError) {
        return {
          success: false,
          code: error.code,
          message: error.message,
          resolvedPath: filePath,
        };
      }

      return {
        success: false,
        code: 'SEND_FAILED',
        message: formatErrorMessage(error),
        resolvedPath: filePath,
      };
    }

    const transportKind = resolveTransportKind(requestedMode, draft.kind);
    let uploaded: UploadedMediaInfo;

    try {
      uploaded = await this.uploadMediaToCdn(
        draft.stagedPath || draft.localPath!,
        to,
        transportKind === 'image' ? 1 : 3
      );
    } catch (error) {
      logger.error('Send local media upload error:', error);

      return {
        success: false,
        code: 'UPLOAD_FAILED',
        message: formatErrorMessage(error),
        transportKind,
        displayName: draft.displayName,
        resolvedPath: draft.localPath,
      };
    }

    const mediaItem: MessageItem =
      transportKind === 'image'
        ? {
            type: MessageItemType.IMAGE,
            image_item: {
                media: {
                  encrypt_query_param: uploaded.downloadEncryptedQueryParam,
                  aes_key: Buffer.from(uploaded.aesKeyHex, 'utf8').toString('base64'),
                  encrypt_type: 1,
                },
                mid_size: uploaded.fileSizeCiphertext,
            },
          }
        : {
            type: MessageItemType.FILE,
            file_item: {
              media: {
                encrypt_query_param: uploaded.downloadEncryptedQueryParam,
                aes_key: Buffer.from(uploaded.aesKeyHex, 'utf8').toString('base64'),
                encrypt_type: 1,
              },
              file_name: draft.displayName,
              len: String(uploaded.fileSize),
            },
          };

    try {
      await this.sendMediaItems(
        to,
        mediaItem,
        options.text || '',
        options.contextToken
      );

      return {
        success: true,
        transportKind,
        displayName: draft.displayName,
        resolvedPath: draft.localPath,
      };
    } catch (error) {
      logger.error('Send local media send error:', error);

      return {
        success: false,
        code: 'SEND_FAILED',
        message: formatErrorMessage(error),
        transportKind,
        displayName: draft.displayName,
        resolvedPath: draft.localPath,
      };
    }
  }

  /**
   * Send a reply (convenience method)
   */
  async reply(toMessage: WeChatMessage, text: string): Promise<boolean> {
    // Use sendLongMessage for potentially long content
    return this.sendLongMessage({
      to: toMessage.from,
      text,
      type: 'text',
      contextToken: toMessage.contextToken,
    });
  }

  /**
   * Send a long message by splitting into chunks
   */
  async sendLongMessage(message: SendMessage): Promise<boolean> {
    const chunks = splitMessage(message.text);
    
    if (chunks.length === 1) {
      return this.send(message);
    }

    // Send multiple chunks with part indicators
    let success = true;
    for (let i = 0; i < chunks.length; i++) {
      const partIndicator = `[${i + 1}/${chunks.length}] `;
      const chunkText = i === 0 
        ? chunks[i] + '\n\n--- 待续 ---'
        : partIndicator + chunks[i] + (i < chunks.length - 1 ? '\n\n--- 待续 ---' : '');
      
      const sent = await this.send({
        ...message,
        text: chunkText,
      });
      
      if (!sent) {
        success = false;
      }
      
      // Small delay between messages to avoid rate limiting
      if (i < chunks.length - 1) {
        await this.sleep(500);
      }
    }
    
    return success;
  }

  /**
   * Send markdown formatted message (as text)
   */
  async sendMarkdown(to: string, markdown: string, contextToken?: string): Promise<boolean> {
    return this.send({
      to,
      text: markdown,
      type: 'markdown',
      contextToken,
    });
  }

  /**
   * Send a permission request to user
   */
  async requestPermission(
    to: string,
    request: {
      requestId?: string;
      tool: string;
      action: string;
      category?: string;
      file?: string;
      timeout?: number;
    },
    contextToken?: string
  ): Promise<boolean> {
    const timeout = request.timeout || 120;
    const text = [
      '🔐 权限请求',
      '',
      request.requestId ? `ID: ${request.requestId}` : '',
      `工具: ${request.tool}`,
      `操作: ${request.action}`,
      request.category ? `分类: ${request.category}` : '',
      request.file ? `文件: ${request.file}` : '',
      '',
      '回复 y / yes / /approve 允许',
      '回复 n / no / /deny 拒绝',
      `${timeout}秒无响应自动拒绝`,
    ].filter(Boolean).join('\n');

    return this.send({ to, text, contextToken });
  }

  private async uploadMediaToCdn(
    filePath: string,
    toUserId: string,
    mediaType: 1 | 3
  ): Promise<UploadedMediaInfo> {
    const plaintext = await fs.readFile(filePath);
    const rawsize = plaintext.length;
    const rawfilemd5 = createHash('md5').update(plaintext).digest('hex');
    const filesize = aesEcbPaddedSize(rawsize);
    const filekey = randomBytes(16).toString('hex');
    const aesKey = randomBytes(16);
    const aesKeyHex = aesKey.toString('hex');

    const uploadUrlResp = await this.request<GetUploadUrlResp>(
      'ilink/bot/getuploadurl',
      {
        filekey,
        media_type: mediaType,
        to_user_id: toUserId,
        rawsize,
        rawfilemd5,
        filesize,
        no_need_thumb: true,
        aeskey: aesKeyHex,
      }
    );

    const uploadParam = uploadUrlResp.upload_param;
    if (!uploadParam) {
      throw new Error('getuploadurl returned no upload_param');
    }

    const ciphertext = encryptAesEcb(plaintext, aesKey);
    const cdnUrl =
      `${this.cdnBaseUrl}/upload?encrypted_query_param=${encodeURIComponent(uploadParam)}` +
      `&filekey=${encodeURIComponent(filekey)}`;

    let downloadParam: string | null = null;
    let lastError: unknown;

    for (let attempt = 1; attempt <= CDN_UPLOAD_MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(cdnUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: new Uint8Array(ciphertext),
        });

        if (response.status >= 400 && response.status < 500) {
          const errorText = response.headers.get('x-error-message') || (await response.text());
          throw new Error(`CDN upload client error ${response.status}: ${errorText}`);
        }

        if (response.status !== 200) {
          const errorText = response.headers.get('x-error-message') || `status ${response.status}`;
          throw new Error(`CDN upload server error: ${errorText}`);
        }

        downloadParam = response.headers.get('x-encrypted-param');
        if (!downloadParam) {
          throw new Error('CDN upload response missing x-encrypted-param header');
        }

        break;
      } catch (error) {
        lastError = error;
        logger.error(
          `CDN upload attempt ${attempt}/${CDN_UPLOAD_MAX_RETRIES} failed: ${formatErrorMessage(error)}`
        );

        if (error instanceof Error && error.message.includes('client error')) {
          throw error;
        }
      }
    }

    if (!downloadParam) {
      throw new Error(formatErrorMessage(lastError));
    }

    return {
      downloadEncryptedQueryParam: downloadParam,
      aesKeyHex,
      fileSize: rawsize,
      fileSizeCiphertext: filesize,
    };
  }

  private async sendMediaItems(
    to: string,
    mediaItem: MessageItem,
    text: string,
    contextToken?: string
  ): Promise<boolean> {
    const items: MessageItem[] = [];

    if (text) {
      items.push({
        type: MessageItemType.TEXT,
        text_item: { text },
      });
    }

    items.push(mediaItem);

    for (const item of items) {
      const clientId = this.generateClientId();
      const msg: OutboundMessage = {
        from_user_id: '',
        to_user_id: to,
        client_id: clientId,
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        context_token: contextToken || '',
        item_list: [item],
      };

      await this.request<void>('ilink/bot/sendmessage', { msg });
    }

    return true;
  }

  /**
   * Helper: sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      const elapsed = Date.now() - this.lastHeartbeat.getTime();
      
      if (elapsed > HEARTBEAT_INTERVAL * 2) {
        logger.warn(`Heartbeat timeout: no response for ${elapsed / 1000}s`);
      } else {
        logger.debug(`Heartbeat OK, last response ${elapsed / 1000}s ago`);
      }
    }, HEARTBEAT_INTERVAL);

    logger.info('Heartbeat monitoring started');
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      logger.info('Heartbeat monitoring stopped');
    }
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    const elapsed = Date.now() - this.lastHeartbeat.getTime();
    return elapsed < HEARTBEAT_INTERVAL * 3 && this.consecutiveErrors < 5;
  }

  /**
   * Get connection stats
   */
  getStats(): {
    consecutiveErrors: number;
    lastHeartbeat: Date;
    healthy: boolean;
    retryDelay: number;
  } {
    return {
      consecutiveErrors: this.consecutiveErrors,
      lastHeartbeat: this.lastHeartbeat,
      healthy: this.isHealthy(),
      retryDelay: this.retryDelay,
    };
  }
}

export default ILinkClient;
