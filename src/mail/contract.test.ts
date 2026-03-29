import {
  createMailMessageDraft,
  formatMailAddress,
  isValidEmailAddress,
  normalizeMailAddress,
  parseMailAddressList,
  summarizeMailDraft,
} from './contract';
import { createLocalMediaDraft } from '../media/contract';

describe('mail contract', () => {
  it('should validate basic email addresses', () => {
    expect(isValidEmailAddress('demo@example.com')).toBe(true);
    expect(isValidEmailAddress('demo.example.com')).toBe(false);
  });

  it('should normalize named addresses', () => {
    expect(normalizeMailAddress('Bridge <bot@example.com>')).toEqual({
      name: 'Bridge',
      address: 'bot@example.com',
    });
  });

  it('should parse recipient lists from strings and arrays', () => {
    expect(
      parseMailAddressList('a@example.com; Bridge <b@example.com>')
    ).toEqual([
      { address: 'a@example.com' },
      { name: 'Bridge', address: 'b@example.com' },
    ]);
  });

  it('should build multipart drafts when text and html are both present', () => {
    const attachment = createLocalMediaDraft('./reports/summary.pdf', {
      sendIntent: 'mail_attachment',
    });

    const draft = createMailMessageDraft({
      from: { address: 'bot@example.com', name: 'Bridge' },
      recipients: {
        to: [{ address: 'user@example.com' }],
      },
      subject: 'Weekly Summary',
      textBody: 'Plain text body',
      htmlBody: '<p>HTML body</p>',
      attachments: [{ attachment, inline: false }],
    });

    expect(draft.provider).toBe('smtp');
    expect(draft.bodyFormat).toBe('multipart');
    expect(draft.attachments).toHaveLength(1);
    expect(summarizeMailDraft(draft)).toContain('Weekly Summary');
  });

  it('should reject drafts without recipients', () => {
    expect(() =>
      createMailMessageDraft({
        from: { address: 'bot@example.com' },
        recipients: {},
        subject: 'No recipient',
        textBody: 'demo',
      })
    ).toThrow('至少需要一个收件人');
  });

  it('should format mail addresses for logs and SMTP envelopes', () => {
    expect(
      formatMailAddress({ name: 'Bridge', address: 'bot@example.com' })
    ).toBe('Bridge <bot@example.com>');
  });
});
