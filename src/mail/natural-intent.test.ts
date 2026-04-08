import { resolveNaturalMailIntent } from './natural-intent';

describe('resolveNaturalMailIntent', () => {
  it('should ignore unrelated natural language', async () => {
    const result = await resolveNaturalMailIntent(
      '帮我检查一下 mail sender 的重试逻辑'
    );

    expect(result).toBeNull();
  });

  it('should resolve a text mail request with explicit recipient', async () => {
    const result = await resolveNaturalMailIntent(
      '给 user@example.com 发邮件，主题是 周报，内容是 今天已完成修复'
    );

    expect(result).toMatchObject({
      kind: 'resolved',
      subject: '周报',
      textBody: '今天已完成修复',
      recipients: [{ address: 'user@example.com' }],
    });
  });

  it('should use default recipients when the request omits them', async () => {
    const result = await resolveNaturalMailIntent(
      '发邮件，主题是 今日进展，内容是 已完成回归验证',
      {
        defaultRecipients: [{ address: 'team@example.com' }],
      }
    );

    expect(result).toMatchObject({
      kind: 'resolved',
      subject: '今日进展',
      textBody: '已完成回归验证',
      recipients: [{ address: 'team@example.com' }],
    });
  });

  it('should ask for clarification when required fields are missing', async () => {
    const result = await resolveNaturalMailIntent(
      '给 user@example.com 发邮件，主题是 周报'
    );

    expect(result).toMatchObject({
      kind: 'clarify',
    });
    expect(result?.message).toContain('信息还不完整');
  });
});
