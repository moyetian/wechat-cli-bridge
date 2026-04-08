import fs from 'fs-extra';
import path from 'path';
import storage from '../utils/storage';
import {
  PrepareResearchWorkflowOptions,
  ResearchArtifactSpec,
  ResearchPreparationResult,
} from './contract';

function resolveResearchAgent(
  defaultAgent: string,
  availableAgents: string[]
): string {
  const candidates = [defaultAgent, 'claude', 'codex', 'gemini', 'iflow'];
  for (const candidate of candidates) {
    if (availableAgents.includes(candidate)) {
      return candidate;
    }
  }

  return defaultAgent;
}

export class ResearchProposalAdapter {
  async prepareWorkflow(
    options: PrepareResearchWorkflowOptions
  ): Promise<ResearchPreparationResult> {
    const artifactDir = path.join(storage.sessionsDir, options.userId, 'artifacts', options.jobId);
    await fs.ensureDir(artifactDir);

    const briefPath = path.join(artifactDir, 'research-brief.md');
    const proposalPath = path.join(artifactDir, 'proposal.md');
    const noveltyPath = path.join(artifactDir, 'novelty-check.md');
    const budgetPath = path.join(artifactDir, 'budget-estimate.md');
    const promptPath = path.join(artifactDir, 'proposal-task.md');

    const briefContent = [
      '# Research Workflow Brief',
      '',
      `- Job ID: ${options.jobId}`,
      `- Route: ${options.route}`,
      `- Working Directory: ${options.workingDir}`,
      '',
      '## Original Request',
      options.requestText,
      '',
    ].join('\n');
    await fs.writeFile(briefPath, briefContent, 'utf8');
    await fs.writeFile(proposalPath, '# Research Proposal\n\n', 'utf8');
    await fs.writeFile(noveltyPath, '# Novelty Check\n\n', 'utf8');
    await fs.writeFile(budgetPath, '# Budget Estimate\n\n', 'utf8');

    const prompt = this.buildPrompt({
      route: options.route,
      requestText: options.requestText,
      proposalPath,
      noveltyPath,
      budgetPath,
      artifactDir,
    });
    await fs.writeFile(promptPath, prompt, 'utf8');

    const artifacts: ResearchArtifactSpec[] = [
      {
        kind: 'research_brief',
        label: 'Research brief',
        path: briefPath,
        summary: '研究 brief',
      },
      {
        kind: 'research_proposal',
        label: 'Research proposal',
        path: proposalPath,
        summary: '研究计划草稿',
      },
      {
        kind: 'research_novelty_check',
        label: 'Novelty check',
        path: noveltyPath,
        summary: 'novelty / feasibility 占位文件',
      },
      {
        kind: 'research_budget_estimate',
        label: 'Budget estimate',
        path: budgetPath,
        summary: '预算与运行时估算占位文件',
      },
      {
        kind: 'research_task',
        label: 'Research task prompt',
        path: promptPath,
        summary: 'proposal lane 执行提示词',
      },
    ];

    return {
      prompt,
      agentName: resolveResearchAgent(options.defaultAgent, options.availableAgents),
      artifactDir,
      artifacts,
    };
  }

  private buildPrompt(options: {
    route: 'research_idea' | 'research_plan';
    requestText: string;
    proposalPath: string;
    noveltyPath: string;
    budgetPath: string;
    artifactDir: string;
  }): string {
    const mode =
      options.route === 'research_plan' ? 'research-plan' : 'research-idea';

    return [
      `你正在执行 research proposal lane（${mode}）。`,
      '',
      '工作要求：',
      `- 将研究计划写入：${options.proposalPath}`,
      `- 将 novelty / feasibility 粗检写入：${options.noveltyPath}`,
      `- 将预算 / 运行时 / 风险估算写入：${options.budgetPath}`,
      `- 所有中间产物放到：${options.artifactDir}`,
      '- 这是 proposal lane，不要启动真实实验，不要假装已经运行 AI Scientist-v2。',
      '- 输出要清楚区分：研究问题、假设、方法、数据/环境需求、预算、风险、下一步审批点。',
      '',
      '原始用户请求：',
      options.requestText,
    ].join('\n');
  }
}
