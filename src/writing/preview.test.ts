import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { materializeWeChatPreviewHtml } from './preview';
import { buildArticleImagePlan } from './image-plan';
import { resolveArticleImageProvider } from './image-provider';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-wechat-preview-test',
  Date.now().toString()
);

describe('materializeWeChatPreviewHtml', () => {
  afterEach(async () => {
    await fs.remove(TEST_DIR);
  });

  it('should render markdown draft into a wechat-style html preview', async () => {
    const draftPath = path.join(TEST_DIR, 'draft.md');
    const previewPath = path.join(TEST_DIR, 'wechat-preview.html');
    await fs.ensureDir(TEST_DIR);
    await fs.writeFile(
      draftPath,
      [
        '# 多智能体协作与控制平面',
        '',
        '## 开场',
        '这是一个用于测试的公众号草稿。',
        '',
        '> 这是引用内容。',
      ].join('\n'),
      'utf8'
    );

    const plan = buildArticleImagePlan({
      topic: '多智能体协作与控制平面',
      draftMarkdown: await fs.readFile(draftPath, 'utf8'),
    });
    const imageResult = await resolveArticleImageProvider({ mode: 'placeholder_svg' }).generate(plan, {
      artifactDir: TEST_DIR,
    });
    const result = await materializeWeChatPreviewHtml({
      draftPath,
      previewPath,
      imagePlan: plan,
      imageAssets: imageResult.assets,
      publicUrl: 'http://example.com/previews/job-1/',
    });
    const html = await fs.readFile(previewPath, 'utf8');

    expect(result.title).toBe('多智能体协作与控制平面');
    expect(html).toContain('微信文章预览');
    expect(html).toContain('多智能体协作与控制平面');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('这是一个用于测试的公众号草稿');
    expect(html).toContain('阅读原文');
    expect(html).toContain('article-figure');
    expect(html).toContain('data:image/svg+xml;base64,');
  });

  it('should skip generic title placeholders when picking the page title', async () => {
    const draftPath = path.join(TEST_DIR, 'draft-with-title-suggestions.md');
    const previewPath = path.join(TEST_DIR, 'wechat-preview-title.html');
    await fs.ensureDir(TEST_DIR);
    await fs.writeFile(
      draftPath,
      [
        '# 标题建议',
        '',
        '1. 这是标题建议',
        '',
        '# 真正的文章标题',
        '',
        '正文内容。',
      ].join('\n'),
      'utf8'
    );

    const result = await materializeWeChatPreviewHtml({
      draftPath,
      previewPath,
    });

    expect(result.title).toBe('真正的文章标题');
  });
});
