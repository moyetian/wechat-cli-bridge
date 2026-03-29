import { MediaAttachmentDraft } from '../media/contract';

export type MailProviderType = 'smtp';
export type MailBodyFormat = 'text' | 'html' | 'multipart';
export type MailDeliveryStatus = 'draft' | 'validated' | 'queued' | 'sent' | 'failed';

export interface MailAddress {
  address: string;
  name?: string;
}

export interface MailRecipients {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
}

export interface MailAttachment {
  attachment: MediaAttachmentDraft;
  inline: boolean;
  contentId?: string;
}

export interface MailMessageDraft {
  provider: MailProviderType;
  from: MailAddress;
  replyTo?: MailAddress;
  recipients: MailRecipients;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  bodyFormat: MailBodyFormat;
  attachments: MailAttachment[];
  status: MailDeliveryStatus;
}

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(value: string): boolean {
  return SIMPLE_EMAIL_PATTERN.test(value.trim());
}

export function normalizeMailAddress(input: string): MailAddress | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const namedMatch = trimmed.match(/^(.+?)\s*<([^<>]+)>$/);
  if (namedMatch) {
    const name = namedMatch[1].trim().replace(/^"|"$/g, '');
    const address = namedMatch[2].trim().toLowerCase();
    if (!isValidEmailAddress(address)) {
      return null;
    }

    return {
      address,
      ...(name ? { name } : {}),
    };
  }

  const address = trimmed.toLowerCase();
  if (!isValidEmailAddress(address)) {
    return null;
  }

  return { address };
}

export function formatMailAddress(address: MailAddress): string {
  return address.name ? `${address.name} <${address.address}>` : address.address;
}

export function parseMailAddressList(input: string | string[] | undefined): MailAddress[] {
  if (!input) {
    return [];
  }

  const values = Array.isArray(input)
    ? input
    : input
        .split(/[,\n;]/)
        .map(item => item.trim())
        .filter(Boolean);

  const parsed: MailAddress[] = [];
  for (const value of values) {
    const normalized = normalizeMailAddress(value);
    if (normalized) {
      parsed.push(normalized);
    }
  }

  return parsed;
}

function determineBodyFormat(textBody?: string, htmlBody?: string): MailBodyFormat {
  if (textBody && htmlBody) {
    return 'multipart';
  }

  if (htmlBody) {
    return 'html';
  }

  return 'text';
}

function normalizeRecipients(
  recipients: Partial<MailRecipients> | undefined
): MailRecipients {
  return {
    to: recipients?.to || [],
    cc: recipients?.cc || [],
    bcc: recipients?.bcc || [],
  };
}

export function createMailMessageDraft(options: {
  from: MailAddress;
  replyTo?: MailAddress;
  recipients: Partial<MailRecipients>;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  attachments?: MailAttachment[];
}): MailMessageDraft {
  const subject = options.subject.trim();
  const textBody = options.textBody?.trim();
  const htmlBody = options.htmlBody?.trim();
  const recipients = normalizeRecipients(options.recipients);
  const recipientCount =
    recipients.to.length + recipients.cc.length + recipients.bcc.length;

  if (!subject) {
    throw new Error('邮件主题不能为空');
  }

  if (recipientCount === 0) {
    throw new Error('至少需要一个收件人');
  }

  if (!textBody && !htmlBody) {
    throw new Error('邮件正文不能为空');
  }

  return {
    provider: 'smtp',
    from: options.from,
    replyTo: options.replyTo,
    recipients,
    subject,
    textBody,
    htmlBody,
    bodyFormat: determineBodyFormat(textBody, htmlBody),
    attachments: options.attachments || [],
    status: 'draft',
  };
}

export function summarizeMailDraft(draft: MailMessageDraft): string {
  const recipientCount =
    draft.recipients.to.length +
    draft.recipients.cc.length +
    draft.recipients.bcc.length;
  return `${draft.provider}: ${draft.subject} (${recipientCount} recipients, ${draft.attachments.length} attachments)`;
}
