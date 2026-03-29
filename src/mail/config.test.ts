import {
  createDefaultMailChannelConfig,
  isMailChannelConfigured,
  normalizeMailChannelConfig,
  summarizeMailChannelConfig,
} from './config';

describe('mail config', () => {
  it('should create a disabled default SMTP config', () => {
    const config = createDefaultMailChannelConfig();

    expect(config.enabled).toBe(false);
    expect(config.provider).toBe('smtp');
    expect(config.smtp.port).toBe(465);
    expect(config.maxAttachmentSizeMB).toBe(25);
  });

  it('should normalize a user-provided mail config', () => {
    const config = normalizeMailChannelConfig({
      enabled: true,
      from: 'Bridge <bot@example.com>',
      replyTo: 'reply@example.com',
      defaultTo: ['user@example.com'],
      maxAttachmentSizeMB: 40,
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'bot@example.com',
        pass: 'app-password',
      },
    });

    expect(config.enabled).toBe(true);
    expect(config.from?.address).toBe('bot@example.com');
    expect(config.replyTo?.address).toBe('reply@example.com');
    expect(config.defaultTo[0].address).toBe('user@example.com');
    expect(config.smtp.port).toBe(587);
    expect(config.maxAttachmentSizeMB).toBe(40);
    expect(isMailChannelConfigured(config)).toBe(true);
  });

  it('should keep mail disabled when required SMTP fields are missing', () => {
    const config = normalizeMailChannelConfig({
      enabled: true,
      smtp: {
        host: 'smtp.example.com',
      },
    });

    expect(isMailChannelConfigured(config)).toBe(false);
  });

  it('should summarize the effective mail config for diagnostics', () => {
    const summary = summarizeMailChannelConfig(
      normalizeMailChannelConfig({
        enabled: true,
        from: 'Bridge <bot@example.com>',
        smtp: {
          host: 'smtp.example.com',
          secure: true,
          user: 'bot@example.com',
          pass: 'secret',
        },
      })
    );

    expect(summary).toContain('smtp:enabled');
    expect(summary).toContain('smtp.example.com:465/secure');
  });
});
