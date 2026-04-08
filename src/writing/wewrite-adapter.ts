import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import storage from '../utils/storage';
import {
  PrepareWritingWorkflowOptions,
  WritingArtifactSpec,
  WritingPreparationResult,
} from './contract';
import {
  isWeWriteMockModeEnabled,
  materializeMockWritingArtifacts,
  WEWRITE_MOCK_MODE_ENV,
} from './mock-runner';

function resolveWeWritePythonCommand(skillPath: string | null): string {
  if (!skillPath) {
    return 'python3';
  }

  const pydepsPath = path.join(skillPath, '.pydeps');
  return `PYTHONPATH="${pydepsPath}" python3`;
}

function guessTopic(input: string): string {
  const normalized = input.trim();
  const aboutMatch = normalized.match(/关于(.+?)(?:的)?(?:公众号文章|文章)/);
  if (aboutMatch) {
    return aboutMatch[1].trim();
  }

  const explicitMatch = normalized.match(/主题\s*(?:是|为|:|：)\s*(.+)$/);
  if (explicitMatch) {
    return explicitMatch[1].trim();
  }

  return normalized;
}

export function getDefaultWeWritePathCandidates(): string[] {
  const home = os.homedir();
  const explicitPath = process.env.WEWRITE_SKILL_PATH?.trim();

  if (explicitPath) {
    return [explicitPath];
  }

  return [
    path.join(home, '.claude', 'skills', 'wewrite'),
    path.join(home, '.openclaw', 'skills', 'wewrite'),
    path.join(home, '.moltbot', 'skills', 'wewrite'),
    path.join('/mnt/c/Users/Administrator/.claude/skills', 'wewrite'),
    path.join('/mnt/c/Users/Administrator/.openclaw/skills', 'wewrite'),
    path.join('/mnt/c/Users/Administrator/.moltbot/skills', 'wewrite'),
    path.join(process.cwd(), '.vendor', 'wewrite'),
  ].filter(Boolean);
}

export async function resolveWeWritePath(
  candidates: string[] = getDefaultWeWritePathCandidates()
): Promise<string | null> {
  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveWritingAgentName(
  defaultAgent: string,
  availableAgents: string[]
): string | null {
  const allowedAgents = ['claude', 'openclaw', 'codex'];
  const candidates = [defaultAgent, 'openclaw', 'claude', 'codex'];

  for (const candidate of candidates) {
    if (
      availableAgents.includes(candidate) &&
      allowedAgents.includes(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

export class WeWriteAdapter {
  async prepareWorkflow(
    options: PrepareWritingWorkflowOptions
  ): Promise<WritingPreparationResult> {
    const topic = guessTopic(options.requestText);
    const artifactDir = path.join(storage.sessionsDir, options.userId, 'artifacts', options.jobId);
    await fs.ensureDir(artifactDir);

    const briefPath = path.join(artifactDir, 'article-brief.md');
    const promptPath = path.join(artifactDir, 'wewrite-task.md');
    const outlinePath = path.join(artifactDir, 'outline.md');
    const draftPath = path.join(artifactDir, 'draft.md');
    const previewPath = path.join(artifactDir, 'wechat-preview.html');
    const imagePlanPath = path.join(artifactDir, 'image-plan.json');
    const imageAssetsPath = path.join(artifactDir, 'image-assets.json');

    const skillPath = await resolveWeWritePath();
    const agentName = resolveWritingAgentName(
      options.defaultAgent,
      options.availableAgents
    );

    const briefContent = [
      '# Article Workflow Brief',
      '',
      `- Job ID: ${options.jobId}`,
      `- Route: ${options.route}`,
      `- Topic: ${topic}`,
      `- Working Directory: ${options.workingDir}`,
      '',
      '## Original Request',
      options.requestText,
      '',
    ].join('\n');
    await fs.writeFile(briefPath, briefContent, 'utf8');

    const prompt = this.buildPrompt({
      route: options.route,
      topic,
      requestText: options.requestText,
      workingDir: options.workingDir,
      artifactDir,
      outlinePath,
      draftPath,
      skillPath,
    });
    await fs.writeFile(promptPath, prompt, 'utf8');
    await fs.writeFile(outlinePath, '# Outline\n\n', 'utf8');
    await fs.writeFile(draftPath, '# Draft\n\n', 'utf8');
    await fs.writeFile(
      previewPath,
      '<!-- WeChat article preview will be generated after draft.md is ready. -->\n',
      'utf8'
    );
    await fs.writeJson(imagePlanPath, { status: 'pending' }, { spaces: 2 });
    await fs.writeJson(imageAssetsPath, { status: 'pending', assets: [] }, { spaces: 2 });

    const artifacts: WritingArtifactSpec[] = [
      {
        kind: 'article_brief',
        label: 'Article brief',
        path: briefPath,
        summary: `公众号文章 brief: ${topic}`,
      },
      {
        kind: 'wewrite_task',
        label: 'WeWrite task prompt',
        path: promptPath,
        summary: `WeWrite 执行提示词: ${topic}`,
      },
      {
        kind: 'article_outline',
        label: 'Article outline',
        path: outlinePath,
        summary: `文章提纲占位文件: ${topic}`,
      },
      {
        kind: 'article_draft',
        label: 'Article draft',
        path: draftPath,
        summary: `文章草稿占位文件: ${topic}`,
      },
      {
        kind: 'article_preview_html',
        label: 'WeChat preview HTML',
        path: previewPath,
        summary: `公众号预览 HTML: ${topic}`,
      },
      {
        kind: 'article_image_plan',
        label: 'Article image plan',
        path: imagePlanPath,
        summary: `文章配图计划: ${topic}`,
      },
      {
        kind: 'article_image_assets',
        label: 'Article image assets',
        path: imageAssetsPath,
        summary: `文章配图资源清单: ${topic}`,
      },
    ];

    if (isWeWriteMockModeEnabled()) {
      await materializeMockWritingArtifacts({
        route: options.route,
        topic,
        requestText: options.requestText,
        outlinePath,
        draftPath,
        previewPath,
        skillPath,
      });

      return {
        status: 'completed_local',
        artifactDir,
        artifacts,
        message:
          `🧪 已启用 WeWrite mock mode（${WEWRITE_MOCK_MODE_ENV}）。已直接生成 article outline / draft，用于本地 UAT。`,
      };
    }

    if (!skillPath) {
      return {
        status: 'integration_missing',
        artifactDir,
        artifacts,
        message:
          '⚠️ 当前未检测到本地 WeWrite 安装路径。已创建 article workflow job 和提示词产物；请先安装 WeWrite 到 `.claude/skills/wewrite` 或设置 `WEWRITE_SKILL_PATH`。',
      };
    }

    if (!agentName) {
      return {
        status: 'integration_missing',
        artifactDir,
        artifacts,
        message:
          '⚠️ 已检测到 WeWrite，但当前没有可用的 `claude`、`openclaw` 或 `codex` agent。请先配置对应 writing lane agent。',
      };
    }

    return {
      status: 'ready',
      prompt,
      agentName,
      artifactDir,
      artifacts,
    };
  }

  private buildPrompt(options: {
    route: 'article_create' | 'article_edit';
    topic: string;
    requestText: string;
    workingDir: string;
    artifactDir: string;
    outlinePath: string;
    draftPath: string;
    skillPath: string | null;
  }): string {
    const modeLabel =
      options.route === 'article_edit' ? 'article-edit' : 'article-create';
    const configPath = options.skillPath
      ? path.join(options.skillPath, 'config.yaml')
      : '(not found)';
    const stylePath = options.skillPath
      ? path.join(options.skillPath, 'style.yaml')
      : '(not found)';
    const frameworksPath = options.skillPath
      ? path.join(options.skillPath, 'references', 'frameworks.md')
      : '(not found)';
    const writingGuidePath = options.skillPath
      ? path.join(options.skillPath, 'references', 'writing-guide.md')
      : '(not found)';
    const projectBriefPath = path.join(options.workingDir, 'GSD', 'PROJECT.md');

    return [
      `你正在执行 WeWrite writing lane workflow（${modeLabel}）。`,
      '',
      '本次任务目标：直接生成公众号文章提纲与正文草稿，并写入指定文件。',
      '',
      '硬性约束：',
      '- 只做 article draft 产出，不要执行发布、配图、诊断、抓热点、学习改稿、统计分析等延伸步骤。',
      '- 不要遍历整个代码仓库，也不要递归扫描整个 WeWrite skill 目录。',
      '- 不要读取 WeWrite 的 `SKILL.md`，除非出现真正阻塞。',
      '- 优先直接用你的写作能力完成任务；只有在需要校准风格时，才按需读取下面列出的少量文件。',
      '- 读取文件数量保持最小，读到足够信息后立刻开始写稿。',
      '',
      '允许按需读取的参考文件：',
      `- WeWrite config: ${configPath}`,
      `- WeWrite style: ${stylePath}`,
      `- WeWrite frameworks: ${frameworksPath}`,
      `- WeWrite writing guide: ${writingGuidePath}`,
      `- Project brief if needed: ${projectBriefPath}`,
      '',
      '执行要求：',
      `- 当前工作目录：${options.workingDir}`,
      `- 如需运行 WeWrite Python 脚本，优先使用：${resolveWeWritePythonCommand(options.skillPath)}`,
      `- 将文章提纲直接覆盖写入：${options.outlinePath}`,
      `- 将文章正文 Markdown 直接覆盖写入：${options.draftPath}`,
      '- bridge 会在 draft.md 完成后自动生成公众号风格 HTML 预览页，无需你额外产出第二份 HTML。',
      `- 所有中间产物放到：${options.artifactDir}`,
      '- 先写提纲，再写正文；不要只输出分析，不要停在计划阶段。',
      '',
      `文章主题：${options.topic}`,
      '',
      '原始用户请求：',
      options.requestText,
      '',
      '输出要求：',
      '- 给出清晰标题建议',
      '- 先列结构化提纲，再写正文',
      '- 如果适合公众号风格，保留小标题和段落节奏',
      '- 完成后只返回一段简短总结，并明确说明 outline 与 draft 已写入目标文件',
    ].join('\n');
  }
}
