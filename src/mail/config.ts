import {
  MailAddress,
  MailProviderType,
  formatMailAddress,
  normalizeMailAddress,
  parseMailAddressList,
} from './contract';

export interface SMTPTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface MailChannelConfig {
  enabled: boolean;
  provider: MailProviderType;
  from?: MailAddress;
  replyTo?: MailAddress;
  defaultTo: MailAddress[];
  maxAttachmentSizeMB: number;
  smtp: SMTPTransportConfig;
}

export const DEFAULT_MAX_MAIL_ATTACHMENT_SIZE_MB = 25;
export const DEFAULT_SMTP_PORT_SECURE = 465;
export const DEFAULT_SMTP_PORT_STARTTLS = 587;

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export function createDefaultMailChannelConfig(): MailChannelConfig {
  return {
    enabled: false,
    provider: 'smtp',
    defaultTo: [],
    maxAttachmentSizeMB: DEFAULT_MAX_MAIL_ATTACHMENT_SIZE_MB,
    smtp: {
      host: '',
      port: DEFAULT_SMTP_PORT_SECURE,
      secure: true,
      user: '',
      pass: '',
    },
  };
}

export function normalizeMailChannelConfig(raw: unknown): MailChannelConfig {
  const base = createDefaultMailChannelConfig();
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const smtpInput =
    input.smtp && typeof input.smtp === 'object' && !Array.isArray(input.smtp)
      ? (input.smtp as Record<string, unknown>)
      : {};
  const secure =
    typeof smtpInput.secure === 'boolean' ? smtpInput.secure : base.smtp.secure;

  return {
    enabled: input.enabled === true,
    provider: 'smtp',
    from:
      typeof input.from === 'string' ? normalizeMailAddress(input.from) || undefined : undefined,
    replyTo:
      typeof input.replyTo === 'string'
        ? normalizeMailAddress(input.replyTo) || undefined
        : undefined,
    defaultTo: parseMailAddressList(
      Array.isArray(input.defaultTo) || typeof input.defaultTo === 'string'
        ? (input.defaultTo as string | string[])
        : undefined
    ),
    maxAttachmentSizeMB: readPositiveInteger(
      input.maxAttachmentSizeMB,
      DEFAULT_MAX_MAIL_ATTACHMENT_SIZE_MB
    ),
    smtp: {
      host: typeof smtpInput.host === 'string' ? smtpInput.host.trim() : '',
      port: readPositiveInteger(
        smtpInput.port,
        secure ? DEFAULT_SMTP_PORT_SECURE : DEFAULT_SMTP_PORT_STARTTLS
      ),
      secure,
      user: typeof smtpInput.user === 'string' ? smtpInput.user.trim() : '',
      pass: typeof smtpInput.pass === 'string' ? smtpInput.pass : '',
    },
  };
}

export function isMailChannelConfigured(config: MailChannelConfig): boolean {
  return Boolean(
    config.enabled &&
      config.from &&
      config.smtp.host &&
      config.smtp.port > 0 &&
      config.smtp.user &&
      config.smtp.pass
  );
}

export function summarizeMailChannelConfig(config: MailChannelConfig): string {
  const from = config.from ? formatMailAddress(config.from) : '(unset)';
  const mode = config.smtp.secure ? 'secure' : 'starttls';
  return `${config.provider}:${config.enabled ? 'enabled' : 'disabled'} from=${from} smtp=${config.smtp.host}:${config.smtp.port}/${mode}`;
}
