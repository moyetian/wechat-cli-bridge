import {
  MailAddress,
  parseMailAddressList,
} from './contract';

const MAIL_ACTION_PATTERNS = [
  /(?:发|发送|寄)邮件/,
  /\bsend\s+(?:an?\s+)?email\b/i,
];

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const SUBJECT_LABEL_PATTERNS = [
  /主题\s*(?:是|为|:|：)/i,
  /subject\s*(?:is|:)/i,
];

const BODY_LABEL_PATTERNS = [
  /(?:正文|内容)\s*(?:是|为|:|：)/i,
  /body\s*(?:is|:)/i,
];

export interface NaturalMailIntentOptions {
  defaultRecipients?: MailAddress[];
}

export interface NaturalMailIntent {
  kind: 'resolved' | 'clarify';
  recipients?: MailAddress[];
  subject?: string;
  textBody?: string;
  message: string;
}

interface LabelMatch {
  index: number;
  end: number;
  name: 'subject' | 'body';
}

function includesAnyPattern(input: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(input));
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function extractEmailRecipients(input: string): MailAddress[] {
  const matches = input.match(EMAIL_PATTERN) || [];
  return parseMailAddressList(matches);
}

function findFirstLabelMatch(
  input: string,
  patterns: RegExp[],
  name: LabelMatch['name']
): LabelMatch | null {
  let bestMatch: LabelMatch | null = null;

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (!match || match.index === undefined) {
      continue;
    }

    const candidate: LabelMatch = {
      index: match.index,
      end: match.index + match[0].length,
      name,
    };

    if (!bestMatch || candidate.index < bestMatch.index) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

function extractLabeledValues(
  input: string
): { subject?: string; body?: string } {
  const matches = [
    findFirstLabelMatch(input, SUBJECT_LABEL_PATTERNS, 'subject'),
    findFirstLabelMatch(input, BODY_LABEL_PATTERNS, 'body'),
  ].filter((match): match is LabelMatch => Boolean(match))
    .sort((left, right) => left.index - right.index);

  if (matches.length === 0) {
    return {};
  }

  const values: { subject?: string; body?: string } = {};
  for (let index = 0; index < matches.length; index++) {
    const current = matches[index];
    const next = matches[index + 1];
    const rawValue = input.slice(current.end, next?.index ?? input.length);
    let value = rawValue
      .replace(/^[\s,，。；;:：-]+/, '')
      .trim();

    if (next) {
      value = value.replace(/[\s,，。；;:：-]+$/, '').trim();
    }

    if (!value) {
      continue;
    }

    if (current.name === 'subject') {
      values.subject = value;
      continue;
    }

    values.body = value;
  }

  return values;
}

function buildClarifyMessage(defaultRecipients: MailAddress[]): string {
  const lines = [
    '⚠️ 我知道你是想直接发邮件，但信息还不完整。',
    '',
    '请至少说清楚：收件人、主题、正文。',
    '',
    '例如：',
    '- 给 user@example.com 发邮件，主题是 周报，内容是 今天已完成修复',
  ];

  if (defaultRecipients.length > 0) {
    lines.push('- 发邮件，主题是 今日进展，内容是 已完成回归验证');
    lines.splice(3, 0, '如果省略收件人，会使用 `mail.defaultTo`。', '');
  } else {
    lines.splice(3, 0, '请明确写出收件邮箱。', '');
  }

  return lines.join('\n');
}

export async function resolveNaturalMailIntent(
  input: string,
  options: NaturalMailIntentOptions = {}
): Promise<NaturalMailIntent | null> {
  const normalized = normalizeWhitespace(input);

  if (!includesAnyPattern(normalized, MAIL_ACTION_PATTERNS)) {
    return null;
  }

  const { subject, body } = extractLabeledValues(normalized);
  if (!subject && !body) {
    return null;
  }

  const defaultRecipients = options.defaultRecipients || [];
  const recipients = extractEmailRecipients(normalized);
  const effectiveRecipients =
    recipients.length > 0 ? recipients : defaultRecipients;

  if (effectiveRecipients.length === 0 || !subject || !body) {
    return {
      kind: 'clarify',
      message: buildClarifyMessage(defaultRecipients),
    };
  }

  return {
    kind: 'resolved',
    recipients: effectiveRecipients,
    subject,
    textBody: body,
    message: `已识别自然语言邮件请求: ${subject}`,
  };
}
