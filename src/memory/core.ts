import { ContextManager } from '../context/manager';
import { SessionContext, WorkflowGateLevel, WorkflowLane, WorkflowRouteName } from '../types';
import { MemoryBundle, MemoryEntry, MemoryLoadProfile, MemoryLoadRequest } from './contract';

function clampEntries<T>(items: T[], limit: number): T[] {
  return items.slice(0, limit);
}

function buildSection(title: string, lines: string[]): string[] {
  if (lines.length === 0) {
    return [];
  }

  return [`## ${title}`, ...lines, ''];
}

export function selectMemoryLoadProfile(options: {
  task?: string;
  route?: WorkflowRouteName;
  lane?: WorkflowLane;
  gate?: WorkflowGateLevel;
}): MemoryLoadProfile {
  if (options.gate === 'approval_required') {
    return 'deep';
  }

  if (
    options.route === 'research_plan' ||
    options.route === 'research_run_request' ||
    options.route === 'paper_rewrite'
  ) {
    return 'deep';
  }

  if (
    options.route === 'article_create' ||
    options.route === 'article_edit' ||
    options.route === 'research_idea' ||
    options.lane === 'writing'
  ) {
    return 'standard';
  }

  const task = (options.task || '').trim();
  if (!task) {
    return 'quick';
  }

  if (
    task.includes('\n') ||
    task.length > 120 ||
    /(架构|方案|设计|研究|论文|workflow|memory|context|重构)/i.test(task)
  ) {
    return 'deep';
  }

  if (/(实现|修改|新增|创建|编写|refactor|implement|fix|add|write)/i.test(task)) {
    return 'standard';
  }

  return 'quick';
}

export class PRISMMemoryCore {
  private contextManager: ContextManager;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
  }

  async loadBundle(request: MemoryLoadRequest): Promise<MemoryBundle> {
    const context = await this.contextManager.load(request.userId);
    const profile =
      request.profile ||
      selectMemoryLoadProfile({
        task: request.task,
        route: request.route,
        lane: request.lane,
        gate: request.gate,
      });

    const entries = this.buildEntries(context, profile);
    return {
      profile,
      entries,
      rendered: this.renderEntries(profile, entries),
      rationale: this.buildRationale(profile, request),
    };
  }

  private buildEntries(
    context: SessionContext,
    profile: MemoryLoadProfile
  ): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const activeWorkflowJobs = context.state.workflowJobs.filter(job =>
      !['completed', 'cancelled', 'failed'].includes(job.status)
    );
    const pendingApprovals = context.state.approvalRequests.filter(
      approval => approval.status === 'pending'
    );

    if (context.projectName) {
      entries.push({
        tier: 'hot',
        label: '项目',
        content: context.projectName,
      });
    }

    if (activeWorkflowJobs.length > 0) {
      const limit = profile === 'quick' ? 1 : profile === 'standard' ? 3 : 5;
      for (const job of clampEntries(activeWorkflowJobs, limit)) {
        entries.push({
          tier: 'hot',
          label: 'Workflow',
          content: `[${job.id.substring(0, 8)}] ${job.route} (${job.status})`,
        });
      }
    }

    if (pendingApprovals.length > 0) {
      const limit = profile === 'quick' ? 1 : 3;
      for (const approval of clampEntries(pendingApprovals, limit)) {
        entries.push({
          tier: 'hot',
          label: '审批',
          content: `[${approval.id.substring(0, 8)}] ${approval.tool}: ${approval.action}`,
        });
      }
    }

    const recentDecisions = clampEntries(
      [...context.state.decisions].reverse(),
      profile === 'quick' ? 2 : profile === 'standard' ? 4 : 6
    );
    for (const decision of recentDecisions) {
      entries.push({
        tier: 'warm',
        label: '决策',
        content: decision.decision,
      });
    }

    const recentTasks = clampEntries(
      [...context.state.completedTasks].reverse(),
      profile === 'quick' ? 2 : profile === 'standard' ? 5 : 8
    );
    for (const task of recentTasks) {
      entries.push({
        tier: 'warm',
        label: '任务',
        content: `${task.success ? '✅' : '❌'} ${task.task}`,
      });
    }

    const recentFiles = clampEntries(
      context.state.recentFiles,
      profile === 'quick' ? 3 : profile === 'standard' ? 6 : 10
    );
    for (const file of recentFiles) {
      entries.push({
        tier: 'warm',
        label: '文件',
        content: file,
      });
    }

    if (profile === 'deep') {
      const olderTasks = [...context.state.completedTasks]
        .reverse()
        .slice(8);
      for (const task of olderTasks) {
        entries.push({
          tier: 'cold',
          label: '历史任务',
          content: `${task.success ? '✅' : '❌'} ${task.task}`,
        });
      }

      const olderWorkflowJobs = activeWorkflowJobs.slice(5);
      for (const job of olderWorkflowJobs) {
        entries.push({
          tier: 'cold',
          label: '历史 Workflow',
          content: `[${job.id.substring(0, 8)}] ${job.route} (${job.status})`,
        });
      }

      const blockers = context.state.blockers;
      for (const blocker of blockers) {
        entries.push({
          tier: 'cold',
          label: '阻塞',
          content: blocker,
        });
      }

      if (context.summary) {
        entries.push({
          tier: 'cold',
          label: '压缩摘要',
          content: context.summary,
        });
      }
    }

    return entries;
  }

  private renderEntries(
    profile: MemoryLoadProfile,
    entries: MemoryEntry[]
  ): string {
    const hotLines = entries
      .filter(entry => entry.tier === 'hot')
      .map(entry => `- ${entry.label}: ${entry.content}`);
    const warmLines = entries
      .filter(entry => entry.tier === 'warm')
      .map(entry => `- ${entry.label}: ${entry.content}`);
    const coldLines = entries
      .filter(entry => entry.tier === 'cold')
      .map(entry => `- ${entry.label}: ${entry.content}`);

    const lines = [`# PRISM Memory (${profile})`, ''];
    lines.push(...buildSection('Hot Context', hotLines));
    lines.push(...buildSection('Warm Memory', warmLines));
    lines.push(...buildSection('Cold Archive', coldLines));

    return lines.join('\n').trim();
  }

  private buildRationale(
    profile: MemoryLoadProfile,
    request: MemoryLoadRequest
  ): string {
    const parts = [`profile=${profile}`];
    if (request.route) {
      parts.push(`route=${request.route}`);
    }
    if (request.lane) {
      parts.push(`lane=${request.lane}`);
    }
    if (request.gate) {
      parts.push(`gate=${request.gate}`);
    }
    return parts.join(', ');
  }
}
