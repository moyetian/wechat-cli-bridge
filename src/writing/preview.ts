import fs from 'fs-extra';
import { marked } from 'marked';
import { ArticleImagePlan } from './image-plan';
import { ArticleImageAsset } from './image-provider';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractTitle(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const ignoredTitles = new Set(['标题建议', 'outline', 'draft']);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      const candidate = trimmed.slice(2).trim();
      if (!ignoredTitles.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }

  return '公众号文章预览';
}

function removeLeadingTitle(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const firstContentIndex = lines.findIndex(line => line.trim().length > 0);
  if (firstContentIndex >= 0 && lines[firstContentIndex].trim().startsWith('# ')) {
    lines.splice(firstContentIndex, 1);
    if (lines[firstContentIndex] !== undefined && lines[firstContentIndex].trim() === '') {
      lines.splice(firstContentIndex, 1);
    }
  }

  return lines.join('\n').trim();
}

function extractSummary(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (
      trimmed.startsWith('#') ||
      trimmed.startsWith('>') ||
      trimmed.startsWith('-') ||
      /^\d+\./.test(trimmed)
    ) {
      continue;
    }

    return trimmed.length > 90 ? `${trimmed.slice(0, 90)}...` : trimmed;
  }

  return '公众号文章预览';
}

function renderTemplate(options: {
  title: string;
  summary: string;
  bodyHtml: string;
  publicUrl?: string;
  coverImageHtml?: string;
}): string {
  const renderedAt = new Date().toLocaleString('zh-CN', { hour12: false });
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(options.title)}</title>`,
    '  <style>',
    '    :root {',
    '      --bg: #ededed;',
    '      --card: #ffffff;',
    '      --text: #1f1f1f;',
    '      --muted: #7c7c7c;',
    '      --line: #ececec;',
    '      --accent: #07c160;',
    '      --soft: #f5fbf7;',
    '    }',
    '    * { box-sizing: border-box; }',
    '    body {',
    '      margin: 0;',
    '      background: var(--bg);',
    '      color: var(--text);',
    '      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;',
    '      line-height: 1.82;',
    '    }',
    '    .shell {',
    '      min-height: 100vh;',
    '      padding-bottom: 56px;',
    '    }',
    '    .wechat-bar {',
    '      position: sticky;',
    '      top: 0;',
    '      z-index: 10;',
    '      background: rgba(250, 250, 250, 0.94);',
    '      backdrop-filter: blur(10px);',
    '      border-bottom: 1px solid rgba(0, 0, 0, 0.05);',
    '    }',
    '    .wechat-bar-inner {',
    '      max-width: 900px;',
    '      margin: 0 auto;',
    '      padding: 14px 18px;',
    '      display: flex;',
    '      align-items: center;',
    '      justify-content: space-between;',
    '      gap: 12px;',
    '      color: #404040;',
    '      font-size: 14px;',
    '    }',
    '    .wechat-left {',
    '      display: flex;',
    '      align-items: center;',
    '      gap: 12px;',
    '      min-width: 0;',
    '    }',
    '    .wechat-dot {',
    '      width: 10px;',
    '      height: 10px;',
    '      border-radius: 50%;',
    '      background: var(--accent);',
    '      box-shadow: 0 0 0 6px rgba(7, 193, 96, 0.16);',
    '      flex: 0 0 auto;',
    '    }',
    '    .wechat-title {',
    '      font-weight: 700;',
    '      white-space: nowrap;',
    '      overflow: hidden;',
    '      text-overflow: ellipsis;',
    '    }',
    '    .wechat-right {',
    '      color: var(--muted);',
    '      font-size: 13px;',
    '      white-space: nowrap;',
    '    }',
    '    .page {',
    '      max-width: 900px;',
    '      margin: 0 auto;',
    '      padding: 28px 16px 0;',
    '    }',
    '    .article-shell {',
    '      background: var(--card);',
    '      border: 1px solid rgba(0, 0, 0, 0.04);',
    '      border-radius: 18px;',
    '      box-shadow: 0 20px 56px rgba(0, 0, 0, 0.06);',
    '      overflow: hidden;',
    '    }',
    '    .cover {',
    '      min-height: 172px;',
    '      padding: 28px 28px 24px;',
    '      background: radial-gradient(circle at top left, rgba(7, 193, 96, 0.22), transparent 38%), linear-gradient(135deg, #ffffff 0%, #f7fbf8 56%, #eef8f1 100%);',
    '      border-bottom: 1px solid var(--line);',
    '    }',
    '    .cover-label {',
    '      display: inline-flex;',
    '      align-items: center;',
    '      gap: 8px;',
    '      margin-bottom: 14px;',
    '      padding: 6px 12px;',
    '      border-radius: 999px;',
    '      background: rgba(7, 193, 96, 0.1);',
    '      color: #0d8c4d;',
    '      font-size: 12px;',
    '      font-weight: 700;',
    '      letter-spacing: 0.04em;',
    '    }',
    '    .cover-summary {',
      '      max-width: 660px;',
      '      color: #4f4f4f;',
      '      font-size: 15px;',
      '      line-height: 1.84;',
    '    }',
    '    .cover-media {',
    '      margin-top: 18px;',
    '      border-radius: 20px;',
    '      overflow: hidden;',
      '      background: rgba(255, 255, 255, 0.7);',
    '      border: 1px solid rgba(0, 0, 0, 0.05);',
    '    }',
    '    .cover-media img {',
    '      display: block;',
    '      width: 100%;',
    '      height: auto;',
    '      aspect-ratio: 16 / 9;',
    '      object-fit: cover;',
    '    }',
    '    .article {',
    '      padding: 28px 28px 38px;',
    '    }',
    '    .meta {',
    '      margin-bottom: 22px;',
    '      padding-bottom: 18px;',
    '      border-bottom: 1px solid var(--line);',
    '    }',
    '    .title {',
    '      margin: 0 0 14px;',
    '      font-size: 34px;',
    '      line-height: 1.34;',
    '      letter-spacing: 0.02em;',
    '      font-weight: 700;',
    '      color: #111;',
    '    }',
    '    .subline {',
    '      display: flex;',
    '      align-items: center;',
    '      gap: 12px;',
    '      flex-wrap: wrap;',
    '    }',
    '    .avatar {',
    '      width: 40px;',
    '      height: 40px;',
    '      border-radius: 50%;',
    '      display: inline-flex;',
    '      align-items: center;',
    '      justify-content: center;',
    '      background: linear-gradient(135deg, #07c160 0%, #2bd576 100%);',
    '      color: #fff;',
    '      font-size: 15px;',
    '      font-weight: 700;',
    '      flex: 0 0 auto;',
    '    }',
    '    .meta-copy {',
    '      display: flex;',
    '      flex-direction: column;',
    '      gap: 2px;',
    '    }',
    '    .meta-copy .account {',
    '      color: #242424;',
    '      font-weight: 700;',
    '      font-size: 15px;',
    '    }',
    '    .meta-copy .detail {',
    '      color: var(--muted);',
    '      font-size: 13px;',
    '    }',
    '    .content h1,',
    '    .content h2,',
    '    .content h3 {',
    '      margin: 1.8em 0 0.82em;',
    '      line-height: 1.46;',
    '      color: #111;',
    '    }',
    '    .content h2 {',
    '      font-size: 25px;',
    '    }',
    '    .content h3 {',
    '      font-size: 20px;',
    '    }',
    '    .content p {',
    '      margin: 0.95em 0;',
    '      font-size: 18px;',
    '    }',
    '    .content ul,',
    '    .content ol {',
    '      margin: 1em 0;',
    '      padding-left: 1.5em;',
    '    }',
    '    .content li {',
    '      margin: 0.45em 0;',
    '      font-size: 16px;',
    '    }',
    '    .content blockquote {',
      '      margin: 1.4em 0;',
      '      padding: 14px 18px;',
      '      border-left: 4px solid var(--accent);',
      '      background: var(--soft);',
      '      color: #4b4b4b;',
      '      border-radius: 4px;',
    '    }',
    '    .article-figure {',
    '      margin: 1.6em 0 1.8em;',
    '      border-radius: 16px;',
    '      overflow: hidden;',
    '      background: #fafafa;',
    '      border: 1px solid var(--line);',
    '    }',
    '    .article-figure img {',
    '      display: block;',
    '      width: 100%;',
    '      height: auto;',
    '      aspect-ratio: 16 / 9;',
    '      object-fit: cover;',
    '      background: #f3f3f3;',
    '    }',
    '    .article-figure figcaption {',
    '      padding: 12px 14px;',
    '      color: var(--muted);',
    '      font-size: 13px;',
    '      line-height: 1.7;',
    '    }',
    '    .content hr {',
    '      border: 0;',
    '      border-top: 1px solid var(--line);',
    '      margin: 2em 0;',
    '    }',
    '    .actions {',
    '      display: flex;',
    '      gap: 12px;',
    '      margin-top: 24px;',
    '      flex-wrap: wrap;',
    '    }',
    '    .pill {',
    '      display: inline-flex;',
    '      align-items: center;',
    '      gap: 6px;',
    '      padding: 8px 14px;',
    '      border-radius: 999px;',
    '      border: 1px solid var(--line);',
    '      background: #fff;',
    '      color: #555;',
    '      font-size: 13px;',
    '    }',
    '    .footer {',
      '      margin-top: 32px;',
      '      padding-top: 18px;',
      '      border-top: 1px solid var(--line);',
      '      color: var(--muted);',
      '      font-size: 13px;',
    '    }',
    '    .read-original {',
    '      margin-top: 28px;',
    '      border: 1px solid var(--line);',
    '      border-radius: 14px;',
    '      background: #fafafa;',
    '      overflow: hidden;',
    '    }',
    '    .read-original-title {',
    '      padding: 14px 16px 10px;',
    '      font-size: 12px;',
    '      letter-spacing: 0.08em;',
    '      color: var(--muted);',
    '      font-weight: 700;',
    '    }',
    '    .read-original-link {',
    '      display: flex;',
    '      align-items: center;',
    '      justify-content: space-between;',
    '      gap: 12px;',
    '      padding: 0 16px 16px;',
    '      color: #111;',
    '      text-decoration: none;',
    '      font-size: 16px;',
    '      font-weight: 700;',
    '    }',
    '    .read-original-link span:last-child {',
    '      color: var(--accent);',
    '      font-size: 14px;',
    '      font-weight: 700;',
    '      flex: 0 0 auto;',
    '    }',
    '    @media (max-width: 640px) {',
    '      .page { padding: 0; }',
    '      .article-shell { border-radius: 0; border-left: 0; border-right: 0; }',
    '      .cover { padding: 24px 18px 20px; min-height: 144px; }',
    '      .article { padding: 24px 18px 30px; }',
    '      .title { font-size: 28px; }',
    '      .content p { font-size: 16px; }',
    '    }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="shell">',
    '    <div class="wechat-bar">',
    '      <div class="wechat-bar-inner">',
    '        <div class="wechat-left">',
    '          <span class="wechat-dot"></span>',
    '          <span class="wechat-title">微信文章预览</span>',
    '        </div>',
    `        <div class="wechat-right">${escapeHtml(renderedAt)}</div>`,
    '      </div>',
    '    </div>',
    '    <div class="page">',
    '      <div class="article-shell">',
    '        <section class="cover">',
    '          <div class="cover-label">WECHAT OFFICIAL ACCOUNT PREVIEW</div>',
    `          <div class="cover-summary">${escapeHtml(options.summary)}</div>`,
    options.coverImageHtml ? `          <div class="cover-media">${options.coverImageHtml}</div>` : '',
    '        </section>',
    '        <article class="article">',
    '          <div class="meta">',
    `            <h1 class="title">${escapeHtml(options.title)}</h1>`,
    '            <div class="subline">',
    '              <span class="avatar">桥</span>',
    '              <span class="meta-copy">',
    '                <span class="account">WeChat CLI Bridge</span>',
    `                <span class="detail">公众号草稿预览 · ${escapeHtml(renderedAt)}</span>`,
    '              </span>',
    '            </div>',
    '          </div>',
    `          <div class="content">${options.bodyHtml}</div>`,
    '          <div class="actions">',
    '            <span class="pill">👍 赞</span>',
    '            <span class="pill">⭐ 收藏</span>',
    '            <span class="pill">↗ 转发</span>',
    '          </div>',
    '          <div class="read-original">',
    '            <div class="read-original-title">阅读原文</div>',
    options.publicUrl
      ? `            <a class="read-original-link" href="${escapeHtml(options.publicUrl)}"><span>点击查看完整预览页面</span><span>查看详情</span></a>`
      : '            <div class="read-original-link"><span>当前未配置公网预览链接</span><span>本地产物</span></div>',
    '          </div>',
    '          <div class="footer">此页面由 writing lane 根据 draft.md 自动生成，用于模拟微信公众平台文章阅读界面。</div>',
    '        </article>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</body>',
    '</html>',
  ].join('\n');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderImageTag(asset: ArticleImageAsset, eager = false): string {
  return `<img src="${asset.dataUri}" alt="${escapeHtml(asset.alt)}"${eager ? ' loading="eager"' : ' loading="lazy"'} />`;
}

function renderInlineFigure(asset: ArticleImageAsset): string {
  return [
    '<figure class="article-figure">',
    `  ${renderImageTag(asset)}`,
    `  <figcaption>${escapeHtml(asset.caption)}</figcaption>`,
    '</figure>',
  ].join('\n');
}

function injectInlineFigures(
  bodyHtml: string,
  plan: ArticleImagePlan | undefined,
  assets: ArticleImageAsset[]
): string {
  if (!plan) {
    return bodyHtml;
  }

  const inlineSlots = plan.slots.filter(slot => slot.placement === 'inline');
  let rendered = bodyHtml;

  for (const slot of inlineSlots) {
    const asset = assets.find(item => item.slotId === slot.id);
    if (!asset) {
      continue;
    }

    const figureHtml = renderInlineFigure(asset);
    if (slot.targetHeading) {
      const headingPattern = new RegExp(
        `(<h2[^>]*>${escapeRegex(slot.targetHeading)}<\\/h2>)`
      );
      if (headingPattern.test(rendered)) {
        rendered = rendered.replace(headingPattern, `$1\n${figureHtml}`);
        continue;
      }
    }

    rendered += `\n${figureHtml}`;
  }

  return rendered;
}

export async function materializeWeChatPreviewHtml(options: {
  draftPath: string;
  previewPath: string;
  publicUrl?: string;
  imagePlan?: ArticleImagePlan;
  imageAssets?: ArticleImageAsset[];
}): Promise<{ title: string; previewPath: string }> {
  const markdown = await fs.readFile(options.draftPath, 'utf8');
  const title = extractTitle(markdown);
  const bodyMarkdown = removeLeadingTitle(markdown) || markdown;
  const summary = extractSummary(bodyMarkdown);
  const renderedBodyHtml = await marked.parse(bodyMarkdown, {
    gfm: true,
    breaks: true,
  });
  const imageAssets = options.imageAssets || [];
  const coverAsset = imageAssets.find(item => item.placement === 'cover');
  const bodyHtml = injectInlineFigures(
    renderedBodyHtml,
    options.imagePlan,
    imageAssets
  );
  const html = renderTemplate({
    title,
    summary,
    bodyHtml,
    publicUrl: options.publicUrl,
    coverImageHtml: coverAsset ? renderImageTag(coverAsset, true) : undefined,
  });
  await fs.writeFile(options.previewPath, html, 'utf8');
  return {
    title,
    previewPath: options.previewPath,
  };
}
