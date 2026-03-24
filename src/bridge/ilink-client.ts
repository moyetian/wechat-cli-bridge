import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { WeChatMessage, SendMessage } from '../types';

// ── API Constants ───────────────────────────────────────────────────────────

export const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com';

/** Maximum message length for WeChat (conservative limit) */
const MAX_MESSAGE_LENGTH = 2000;

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

interface SendMessageReq {
  msg: OutboundMessage;
}

// ── Helper Functions ────────────────────────────────────────────────────────

function generateUin(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString('base64');
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
      'X-WECHAT-UIN': this.uin,
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
        body: JSON.stringify(body),
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
    logger.info('Started polling for messages...');

    while (this.running) {
      try {
        const messages = await this.getUpdates();
        if (messages.length > 0) {
          yield messages;
        }
      } catch (error) {
        logger.error('Polling error:', error);
        await this.sleep(5000);
      }
    }
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.running = false;
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
      const toUserId = msg.to_user_id || '';
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
        from_user_id: this.accountId,
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
    request: { tool: string; action: string; file?: string },
    contextToken?: string
  ): Promise<boolean> {
    const text = [
      '🔐 权限请求',
      '',
      `工具: ${request.tool}`,
      `操作: ${request.action}`,
      request.file ? `文件: ${request.file}` : '',
      '',
      '回复 y 允许，回复 n 拒绝',
      '120秒无响应自动拒绝',
    ].filter(Boolean).join('\n');

    return this.send({ to, text, contextToken });
  }

  /**
   * Helper: sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ILinkClient;
