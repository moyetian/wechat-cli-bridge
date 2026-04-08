import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { buildArticleImagePlan } from './image-plan';
import {
  OpenAIImageProvider,
  resolveArticleImageProvider,
  resolveArticleImageProviderConfig,
} from './image-provider';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-image-provider-test',
  Date.now().toString()
);

describe('article image provider', () => {
  afterEach(async () => {
    await fs.remove(TEST_DIR);
  });

  it('should generate placeholder svg assets for planned illustration slots', async () => {
    const provider = resolveArticleImageProvider({ mode: 'placeholder_svg' });
    const plan = buildArticleImagePlan({
      topic: '多Agent协作与控制平面',
      draftMarkdown: [
        '# 多Agent不是多开几个Bot：你真正需要的是一套控制平面',
        '',
        '导语段落。',
        '',
        '## 一、什么叫多Agent控制平面？',
        '定义段落。',
      ].join('\n'),
    });

    const result = await provider.generate(plan, {
      artifactDir: TEST_DIR,
    });

    expect(result.status).toBe('generated');
    expect(result.assets.length).toBeGreaterThanOrEqual(2);
    expect(result.assets[0].dataUri.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(await fs.pathExists(result.assets[0].path)).toBe(true);
  });

  it('should resolve openai image provider config from environment', () => {
    const config = resolveArticleImageProviderConfig({
      WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_PROVIDER: 'openai_images',
      OPENAI_API_KEY: 'test-key',
      WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_MODEL: 'gpt-image-1.5',
      WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_QUALITY: 'high',
      WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_OPENAI_BASE_URL: 'https://api.openai.com',
    });

    expect(config).toEqual({
      mode: 'openai_images',
      apiKey: 'test-key',
      model: 'gpt-image-1.5',
      quality: 'high',
      background: 'auto',
      moderation: 'auto',
      outputFormat: 'png',
      baseUrl: 'https://api.openai.com',
      coverSize: '1536x1024',
      inlineSize: '1536x1024',
    });
  });

  it('should generate image assets through the openai provider with mocked fetch', async () => {
    const provider = new OpenAIImageProvider(
      {
        mode: 'openai_images',
        apiKey: 'test-key',
        model: 'gpt-image-1.5',
        quality: 'medium',
        background: 'auto',
        moderation: 'auto',
        outputFormat: 'png',
        baseUrl: 'https://api.openai.com',
        coverSize: '1536x1024',
        inlineSize: '1536x1024',
      },
      (async () =>
        ({
          ok: true,
          json: async () => ({
            data: [{ b64_json: Buffer.from('fake-image').toString('base64') }],
          }),
        }) as Response) as typeof fetch
    );
    const plan = buildArticleImagePlan({
      topic: '多Agent协作与控制平面',
      draftMarkdown: [
        '# 多Agent不是多开几个Bot：你真正需要的是一套控制平面',
        '',
        '导语段落。',
        '',
        '## 一、什么叫多Agent控制平面？',
        '定义段落。',
      ].join('\n'),
    });

    const result = await provider.generate(plan, {
      artifactDir: TEST_DIR,
    });

    expect(result.status).toBe('generated');
    expect(result.assets[0].dataUri.startsWith('data:image/png;base64,')).toBe(true);
    expect(await fs.pathExists(result.assets[0].path)).toBe(true);
  });
});
