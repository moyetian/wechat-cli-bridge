import fs from 'fs-extra';
import path from 'path';
import { ArticleImagePlan, ArticleImageSlot } from './image-plan';

export interface ArticleImageAsset {
  slotId: string;
  placement: 'cover' | 'inline';
  title: string;
  caption: string;
  alt: string;
  prompt: string;
  path: string;
  dataUri: string;
  targetHeading?: string;
}

export interface ArticleImageProviderResult {
  status: 'generated' | 'skipped' | 'failed';
  assets: ArticleImageAsset[];
  error?: string;
}

export interface ArticleImageProvider {
  generate(plan: ArticleImagePlan, options: {
    artifactDir: string;
  }): Promise<ArticleImageProviderResult>;
}

export type ArticleImageProviderConfig =
  | { mode: 'placeholder_svg' }
  | { mode: 'disabled' }
  | {
      mode: 'openai_images';
      apiKey: string;
      model: string;
      quality: 'low' | 'medium' | 'high' | 'auto';
      background: 'transparent' | 'opaque' | 'auto';
      moderation: 'auto' | 'low';
      outputFormat: 'png' | 'jpeg' | 'webp';
      baseUrl: string;
      coverSize: '1536x1024' | '1024x1024' | '1024x1536' | 'auto';
      inlineSize: '1536x1024' | '1024x1024' | '1024x1536' | 'auto';
    };

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickPalette(seed: string): {
  bgStart: string;
  bgEnd: string;
  accent: string;
  text: string;
  glow: string;
} {
  const palettes = [
    { bgStart: '#f6fbf7', bgEnd: '#dff5e7', accent: '#07c160', text: '#163322', glow: '#b8f0cb' },
    { bgStart: '#f7f9fe', bgEnd: '#dce8ff', accent: '#2f67ff', text: '#1b2e59', glow: '#d0defd' },
    { bgStart: '#fff8f2', bgEnd: '#ffe1c4', accent: '#f28c28', text: '#5c3512', glow: '#ffd8b1' },
    { bgStart: '#f8f5ff', bgEnd: '#e6dbff', accent: '#7b5cff', text: '#38266b', glow: '#ddd0ff' },
  ];

  return palettes[hashString(seed) % palettes.length];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createSvg(slot: ArticleImageSlot): string {
  const palette = pickPalette(slot.title);
  const width = slot.placement === 'cover' ? 1600 : 1280;
  const height = slot.placement === 'cover' ? 900 : 720;
  const title = slot.title.length > 20 ? `${slot.title.slice(0, 20)}...` : slot.title;
  const caption = slot.caption.length > 36 ? `${slot.caption.slice(0, 36)}...` : slot.caption;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">`,
    '  <defs>',
    `    <linearGradient id="bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">`,
    `      <stop stop-color="${palette.bgStart}"/>`,
    `      <stop offset="1" stop-color="${palette.bgEnd}"/>`,
    '    </linearGradient>',
    `    <radialGradient id="glow" cx="0" cy="0" r="1" gradientTransform="translate(${width * 0.15} ${height * 0.2}) rotate(45) scale(${width * 0.45} ${height * 0.5})" gradientUnits="userSpaceOnUse">`,
    `      <stop stop-color="${palette.glow}" stop-opacity="1"/>`,
    `      <stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>`,
    '    </radialGradient>',
    '  </defs>',
    `  <rect width="${width}" height="${height}" rx="48" fill="url(#bg)"/>`,
    `  <rect width="${width}" height="${height}" rx="48" fill="url(#glow)"/>`,
    `  <circle cx="${width * 0.82}" cy="${height * 0.24}" r="${height * 0.18}" fill="${palette.accent}" fill-opacity="0.12"/>`,
    `  <circle cx="${width * 0.9}" cy="${height * 0.74}" r="${height * 0.11}" fill="${palette.accent}" fill-opacity="0.15"/>`,
    `  <rect x="${width * 0.11}" y="${height * 0.16}" width="${width * 0.34}" height="${height * 0.62}" rx="36" fill="#ffffff" fill-opacity="0.72"/>`,
    `  <rect x="${width * 0.16}" y="${height * 0.26}" width="${width * 0.24}" height="22" rx="11" fill="${palette.accent}" fill-opacity="0.14"/>`,
    `  <rect x="${width * 0.16}" y="${height * 0.33}" width="${width * 0.2}" height="18" rx="9" fill="${palette.accent}" fill-opacity="0.09"/>`,
    `  <rect x="${width * 0.16}" y="${height * 0.4}" width="${width * 0.18}" height="18" rx="9" fill="${palette.accent}" fill-opacity="0.09"/>`,
    `  <rect x="${width * 0.16}" y="${height * 0.52}" width="${width * 0.24}" height="120" rx="28" fill="${palette.accent}" fill-opacity="0.12"/>`,
    `  <text x="${width * 0.53}" y="${height * 0.26}" fill="${palette.accent}" font-size="${slot.placement === 'cover' ? 34 : 30}" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-weight="700" letter-spacing="4">AI ILLUSTRATION SLOT</text>`,
    `  <text x="${width * 0.53}" y="${height * 0.4}" fill="${palette.text}" font-size="${slot.placement === 'cover' ? 84 : 70}" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-weight="700">${escapeXml(title)}</text>`,
    `  <text x="${width * 0.53}" y="${height * 0.5}" fill="${palette.text}" font-size="30" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-weight="500">${escapeXml(caption)}</text>`,
    `  <text x="${width * 0.53}" y="${height * 0.64}" fill="${palette.text}" fill-opacity="0.78" font-size="26" font-family="PingFang SC, Microsoft YaHei, sans-serif">为公众号文章预留的插图位，可替换为真实 AI 生图。</text>`,
    `  <text x="${width * 0.53}" y="${height * 0.72}" fill="${palette.text}" fill-opacity="0.6" font-size="22" font-family="PingFang SC, Microsoft YaHei, sans-serif">${escapeXml(slot.prompt.slice(0, 80))}</text>`,
    '</svg>',
  ].join('\n');
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

export function resolveArticleImageProviderConfig(
  env: NodeJS.ProcessEnv = process.env
): ArticleImageProviderConfig {
  const raw = env.WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_PROVIDER?.trim().toLowerCase();

  if (raw === 'disabled') {
    return { mode: 'disabled' };
  }

  if (raw === 'openai' || raw === 'openai_images') {
    return {
      mode: 'openai_images',
      apiKey: env.OPENAI_API_KEY?.trim() || '',
      model: env.WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_MODEL?.trim() || 'gpt-image-1.5',
      quality:
        (env.WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_QUALITY?.trim().toLowerCase() as
          | 'low'
          | 'medium'
          | 'high'
          | 'auto'
          | undefined) || 'medium',
      background:
        (env.WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_BACKGROUND?.trim().toLowerCase() as
          | 'transparent'
          | 'opaque'
          | 'auto'
          | undefined) || 'auto',
      moderation:
        (env.WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_MODERATION?.trim().toLowerCase() as
          | 'auto'
          | 'low'
          | undefined) || 'auto',
      outputFormat:
        (env.WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_OUTPUT_FORMAT?.trim().toLowerCase() as
          | 'png'
          | 'jpeg'
          | 'webp'
          | undefined) || 'png',
      baseUrl: env.WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_OPENAI_BASE_URL?.trim() || 'https://api.openai.com',
      coverSize:
        (env.WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_COVER_SIZE?.trim() as
          | '1536x1024'
          | '1024x1024'
          | '1024x1536'
          | 'auto'
          | undefined) || '1536x1024',
      inlineSize:
        (env.WECHAT_CLI_BRIDGE_ARTICLE_IMAGE_INLINE_SIZE?.trim() as
          | '1536x1024'
          | '1024x1024'
          | '1024x1536'
          | 'auto'
          | undefined) || '1536x1024',
    };
  }

  return { mode: 'placeholder_svg' };
}

class PlaceholderSvgImageProvider implements ArticleImageProvider {
  async generate(
    plan: ArticleImagePlan,
    options: { artifactDir: string }
  ): Promise<ArticleImageProviderResult> {
    const imageDir = path.join(options.artifactDir, 'images');
    await fs.ensureDir(imageDir);

    const assets: ArticleImageAsset[] = [];
    for (const slot of plan.slots) {
      const svg = createSvg(slot);
      const imagePath = path.join(imageDir, `${slot.id}.svg`);
      await fs.writeFile(imagePath, svg, 'utf8');
      assets.push({
        slotId: slot.id,
        placement: slot.placement,
        title: slot.title,
        caption: slot.caption,
        alt: slot.alt,
        prompt: slot.prompt,
        path: imagePath,
        dataUri: svgToDataUri(svg),
        targetHeading: slot.targetHeading,
      });
    }

    return {
      status: 'generated',
      assets,
    };
  }
}

class DisabledImageProvider implements ArticleImageProvider {
  async generate(): Promise<ArticleImageProviderResult> {
    return {
      status: 'skipped',
      assets: [],
    };
  }
}

function detectMimeType(outputFormat: 'png' | 'jpeg' | 'webp'): string {
  switch (outputFormat) {
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

function buildImagePrompt(slot: ArticleImageSlot): string {
  return [
    slot.prompt,
    '适配微信公众号文章配图，画面完整，信息密度适中，不要在图中渲染中文长句。',
    slot.placement === 'cover'
      ? '封面需要有明显主体和清晰层次，适合文章顶部展示。'
      : '正文插图需要与段落主题一致，强调概念可视化和叙事感。',
  ].join(' ');
}

export class OpenAIImageProvider implements ArticleImageProvider {
  private config: Extract<ArticleImageProviderConfig, { mode: 'openai_images' }>;

  private fetchImpl: typeof fetch;

  constructor(
    config: Extract<ArticleImageProviderConfig, { mode: 'openai_images' }>,
    fetchImpl: typeof fetch = fetch
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async generate(
    plan: ArticleImagePlan,
    options: { artifactDir: string }
  ): Promise<ArticleImageProviderResult> {
    if (!this.config.apiKey) {
      return {
        status: 'failed',
        assets: [],
        error: 'OPENAI_API_KEY is required for openai_images provider.',
      };
    }

    const imageDir = path.join(options.artifactDir, 'images');
    await fs.ensureDir(imageDir);

    const assets: ArticleImageAsset[] = [];

    try {
      for (const slot of plan.slots) {
        const size =
          slot.placement === 'cover'
            ? this.config.coverSize
            : this.config.inlineSize;
        const response = await this.fetchImpl(
          `${this.config.baseUrl.replace(/\/+$/, '')}/v1/images`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
              model: this.config.model,
              prompt: buildImagePrompt(slot),
              size,
              quality: this.config.quality,
              background: this.config.background,
              moderation: this.config.moderation,
              output_format: this.config.outputFormat,
            }),
          }
        );

        const payload = (await response.json().catch(() => ({}))) as {
          data?: Array<{ b64_json?: string }>;
          error?: { message?: string };
        };

        if (!response.ok) {
          return {
            status: 'failed',
            assets,
            error:
              payload.error?.message ||
              `OpenAI image generation failed with HTTP ${response.status}`,
          };
        }

        const imageBase64 = payload.data?.[0]?.b64_json;
        if (!imageBase64) {
          return {
            status: 'failed',
            assets,
            error: 'OpenAI image generation returned no b64_json payload.',
          };
        }

        const extension = this.config.outputFormat === 'jpeg' ? 'jpg' : this.config.outputFormat;
        const imagePath = path.join(imageDir, `${slot.id}.${extension}`);
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        await fs.writeFile(imagePath, imageBuffer);
        assets.push({
          slotId: slot.id,
          placement: slot.placement,
          title: slot.title,
          caption: slot.caption,
          alt: slot.alt,
          prompt: slot.prompt,
          path: imagePath,
          dataUri: `data:${detectMimeType(this.config.outputFormat)};base64,${imageBase64}`,
          targetHeading: slot.targetHeading,
        });
      }
    } catch (error) {
      return {
        status: 'failed',
        assets,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      status: 'generated',
      assets,
    };
  }
}

export function resolveArticleImageProvider(
  config: ArticleImageProviderConfig = resolveArticleImageProviderConfig()
): ArticleImageProvider {
  if (config.mode === 'openai_images') {
    return new OpenAIImageProvider(config);
  }

  if (config.mode === 'disabled') {
    return new DisabledImageProvider();
  }

  return new PlaceholderSvgImageProvider();
}
