import path from 'path';
import {
  createLocalMediaDraft,
  inferDefaultSendIntent,
  inferMediaKindFromPath,
  summarizeMediaDraft,
  supportsSendIntent,
} from './contract';

describe('media contract', () => {
  it('should infer image kinds from common image extensions', () => {
    expect(inferMediaKindFromPath('demo.png')).toBe('image');
    expect(inferMediaKindFromPath('cover.JPG')).toBe('image');
  });

  it('should treat non-image files as generic files', () => {
    expect(inferMediaKindFromPath('report.pdf')).toBe('file');
    expect(inferMediaKindFromPath('archive.zip')).toBe('file');
  });

  it('should infer default send intents from media kind', () => {
    expect(inferDefaultSendIntent('image')).toBe('wechat_image');
    expect(inferDefaultSendIntent('file')).toBe('wechat_file');
  });

  it('should build local media drafts with normalized metadata', () => {
    const draft = createLocalMediaDraft('./assets/screenshot.png', {
      sizeBytes: 1024,
    });

    expect(draft.kind).toBe('image');
    expect(draft.sendIntent).toBe('wechat_image');
    expect(draft.localPath).toBe(path.resolve('./assets/screenshot.png'));
    expect(draft.displayName).toBe('screenshot.png');
    expect(draft.extension).toBe('.png');
    expect(draft.status).toBe('discovered');
  });

  it('should allow intent overrides for future channels', () => {
    const draft = createLocalMediaDraft('./logs/output.txt', {
      sendIntent: 'mail_attachment',
      displayName: 'report.txt',
    });

    expect(draft.sendIntent).toBe('mail_attachment');
    expect(draft.displayName).toBe('report.txt');
    expect(draft.extension).toBe('.txt');
  });

  it('should validate send intents against media kind', () => {
    expect(supportsSendIntent('image', 'wechat_image')).toBe(true);
    expect(supportsSendIntent('file', 'wechat_image')).toBe(false);
    expect(supportsSendIntent('file', 'wechat_file')).toBe(true);
    expect(supportsSendIntent('image', 'mail_attachment')).toBe(true);
  });

  it('should summarize drafts for logging and user feedback', () => {
    const draft = createLocalMediaDraft('./logs/output.txt', {
      sizeBytes: 2048,
    });
    expect(summarizeMediaDraft(draft)).toContain('wechat_file');
    expect(summarizeMediaDraft(draft)).toContain('output.txt');
    expect(summarizeMediaDraft(draft)).toContain('2048 bytes');
  });
});
