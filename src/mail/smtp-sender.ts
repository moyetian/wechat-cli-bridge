import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { MailChannelConfig, isMailChannelConfigured } from './config';
import { formatMailAddress, MailMessageDraft } from './contract';

export interface MailSendResult {
  success: boolean;
  messageId?: string;
  accepted: string[];
  rejected: string[];
  summary: string;
  error?: string;
}

interface MailTransport {
  sendMail(options: {
    from: string;
    replyTo?: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text?: string;
    html?: string;
    attachments: Array<{
      filename: string;
      path?: string;
      cid?: string;
      contentDisposition: 'inline' | 'attachment';
    }>;
  }): Promise<{
    messageId: string;
    accepted: Array<string | { address: string }>;
    rejected: Array<string | { address: string }>;
  }>;
  verify(): Promise<unknown>;
}

export type MailTransportFactory = (
  options: SMTPTransport.Options
) => MailTransport;

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function buildSMTPTransportOptions(
  config: MailChannelConfig
): SMTPTransport.Options {
  return {
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  };
}

export class SMTPMailSender {
  private config: MailChannelConfig;
  private transportFactory: MailTransportFactory;
  private transport?: MailTransport;

  constructor(
    config: MailChannelConfig,
    transportFactory: MailTransportFactory = options =>
      nodemailer.createTransport(options)
  ) {
    this.config = config;
    this.transportFactory = transportFactory;
  }

  private getTransport(): MailTransport {
    if (!this.transport) {
      this.transport = this.transportFactory(buildSMTPTransportOptions(this.config));
    }

    return this.transport;
  }

  async verify(): Promise<void> {
    if (!isMailChannelConfigured(this.config)) {
      throw new Error('邮件通道未完成配置');
    }

    await this.getTransport().verify();
  }

  async send(draft: MailMessageDraft): Promise<MailSendResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        accepted: [],
        rejected: [],
        summary: '邮件通道未启用',
        error: '邮件通道未启用',
      };
    }

    if (!isMailChannelConfigured(this.config)) {
      return {
        success: false,
        accepted: [],
        rejected: [],
        summary: '邮件配置不完整',
        error: '邮件配置不完整',
      };
    }

    try {
      const result = await this.getTransport().sendMail({
        from: formatMailAddress(draft.from),
        replyTo: draft.replyTo ? formatMailAddress(draft.replyTo) : undefined,
        to: draft.recipients.to.map(formatMailAddress),
        cc: draft.recipients.cc.length > 0 ? draft.recipients.cc.map(formatMailAddress) : undefined,
        bcc: draft.recipients.bcc.length > 0 ? draft.recipients.bcc.map(formatMailAddress) : undefined,
        subject: draft.subject,
        text: draft.textBody,
        html: draft.htmlBody,
        attachments: draft.attachments.map(item => ({
          filename: item.attachment.displayName,
          path: item.attachment.stagedPath || item.attachment.localPath,
          cid: item.contentId,
          contentDisposition: item.inline ? 'inline' : 'attachment',
        })),
      });

      const accepted = (result.accepted || []).map(String);
      const rejected = (result.rejected || []).map(String);

      return {
        success: rejected.length === 0,
        messageId: result.messageId,
        accepted,
        rejected,
        summary: `邮件已发送: ${draft.subject}`,
      };
    } catch (error) {
      const message = formatErrorMessage(error);
      return {
        success: false,
        accepted: [],
        rejected: [],
        summary: `邮件发送失败: ${message}`,
        error: message,
      };
    }
  }
}
