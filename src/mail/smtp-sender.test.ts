import {
  createMailMessageDraft,
} from '../mail';
import { createLocalMediaDraft } from '../media';
import { normalizeMailChannelConfig } from './config';
import { buildSMTPTransportOptions, SMTPMailSender } from './smtp-sender';

describe('SMTPMailSender', () => {
  function createSentMessageInfo(messageId: string, accepted: string[] = ['user@example.com']) {
    return {
      messageId,
      accepted,
      rejected: [] as string[],
      pending: [] as string[],
      response: '250 OK',
      envelope: {
        from: 'bot@example.com',
        to: accepted,
      },
    };
  }

  function createConfiguredMailChannel() {
    return normalizeMailChannelConfig({
      enabled: true,
      from: 'Bridge <bot@example.com>',
      defaultTo: ['user@example.com'],
      smtp: {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        user: 'bot@example.com',
        pass: 'secret',
      },
    });
  }

  it('should build SMTP transport options from normalized config', () => {
    const options = buildSMTPTransportOptions(createConfiguredMailChannel());

    expect(options).toMatchObject({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'bot@example.com',
        pass: 'secret',
      },
    });
  });

  it('should send text/html mail through the transport', async () => {
    const sendMail = jest.fn(async () => createSentMessageInfo('msg-1'));
    const verify = jest.fn(async () => true);

    const sender = new SMTPMailSender(createConfiguredMailChannel(), () => ({
      sendMail,
      verify,
    }));

    const draft = createMailMessageDraft({
      from: { address: 'bot@example.com', name: 'Bridge' },
      recipients: {
        to: [{ address: 'user@example.com' }],
      },
      subject: 'Hello',
      textBody: 'Plain',
      htmlBody: '<p>HTML</p>',
    });

    const result = await sender.send(draft);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-1');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Hello',
        text: 'Plain',
        html: '<p>HTML</p>',
        to: ['user@example.com'],
      })
    );
  });

  it('should include local attachments in the SMTP payload', async () => {
    const sendMail = jest.fn(async () => createSentMessageInfo('msg-2'));

    const sender = new SMTPMailSender(createConfiguredMailChannel(), () => ({
      sendMail,
      verify: jest.fn(async () => true),
    }));

    const attachment = createLocalMediaDraft('./reports/summary.pdf', {
      sendIntent: 'mail_attachment',
    });

    const draft = createMailMessageDraft({
      from: { address: 'bot@example.com' },
      recipients: {
        to: [{ address: 'user@example.com' }],
      },
      subject: 'Attachment',
      textBody: 'see attached',
      attachments: [{ attachment, inline: false }],
    });

    await sender.send(draft);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: 'summary.pdf',
            path: attachment.localPath,
            contentDisposition: 'attachment',
          }),
        ],
      })
    );
  });

  it('should fail fast when mail channel is disabled', async () => {
    const sender = new SMTPMailSender(normalizeMailChannelConfig({ enabled: false }), () => {
      throw new Error('should not be called');
    });

    const draft = createMailMessageDraft({
      from: { address: 'bot@example.com' },
      recipients: {
        to: [{ address: 'user@example.com' }],
      },
      subject: 'Disabled',
      textBody: 'demo',
    });

    const result = await sender.send(draft);

    expect(result.success).toBe(false);
    expect(result.error).toContain('未启用');
  });
});
