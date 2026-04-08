export interface ArticleImageSlot {
  id: string;
  placement: 'cover' | 'inline';
  title: string;
  caption: string;
  alt: string;
  prompt: string;
  targetHeading?: string;
  aspectRatio: '16:9';
}

export interface ArticleImagePlan {
  title: string;
  styleDirection: string;
  slots: ArticleImageSlot[];
}

function extractFirstMeaningfulTitle(markdown: string): string {
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

  return '公众号文章';
}

function extractLeadParagraph(markdown: string): string {
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

  return '用于公众号文章的视觉导语。';
}

function extractSections(markdown: string): Array<{ heading: string; summary: string }> {
  const lines = markdown.split(/\r?\n/);
  const sections: Array<{ heading: string; summary: string }> = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line.startsWith('## ')) {
      continue;
    }

    const heading = line.slice(3).trim();
    let summary = '';

    for (let inner = index + 1; inner < lines.length; inner++) {
      const candidate = lines[inner].trim();
      if (!candidate) {
        continue;
      }
      if (candidate.startsWith('#')) {
        break;
      }
      if (
        candidate.startsWith('>') ||
        candidate.startsWith('-') ||
        /^\d+\./.test(candidate)
      ) {
        continue;
      }
      summary = candidate.length > 90 ? `${candidate.slice(0, 90)}...` : candidate;
      break;
    }

    sections.push({
      heading,
      summary: summary || `${heading} 的视觉化延展。`,
    });
  }

  return sections;
}

export function buildArticleImagePlan(options: {
  topic?: string;
  draftMarkdown: string;
}): ArticleImagePlan {
  const title = extractFirstMeaningfulTitle(options.draftMarkdown);
  const topic = options.topic?.trim() || title;
  const leadSummary = extractLeadParagraph(options.draftMarkdown);
  const sections = extractSections(options.draftMarkdown).slice(0, 2);

  const slots: ArticleImageSlot[] = [
    {
      id: 'cover',
      placement: 'cover',
      title,
      caption: `${topic} 的封面概念图`,
      alt: `${topic} 的公众号封面插图`,
      prompt:
        `微信公众号文章封面插图，主题《${title}》，` +
        `${leadSummary}，现代科技 editorial illustration，清晰主体，大面积留白，适合标题覆盖，16:9`,
      aspectRatio: '16:9',
    },
  ];

  for (const [index, section] of sections.entries()) {
    slots.push({
      id: `inline-${index + 1}`,
      placement: 'inline',
      title: section.heading,
      caption: `${section.heading} 插图`,
      alt: `${section.heading} 的正文插图`,
      prompt:
        `微信公众号正文配图，章节《${section.heading}》，` +
        `${section.summary}，信息图解风格，简洁科技感，中文读者友好，16:9`,
      targetHeading: section.heading,
      aspectRatio: '16:9',
    });
  }

  return {
    title,
    styleDirection: 'clean_editorial_tech_wechat',
    slots,
  };
}
