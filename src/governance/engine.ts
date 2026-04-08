import fs from 'fs-extra';
import path from 'path';
import { ResearchArtifactSpec } from '../research/contract';
import {
  WorkflowComputePool,
  WorkflowLane,
  WorkflowRouteName,
} from '../types';
import storage from '../utils/storage';

export type GovernanceDecision =
  | 'pass'
  | 'manual_review'
  | 'blocked'
  | 'not_applicable';

export interface GovernanceGateResult {
  decision: GovernanceDecision;
  summary: string;
}

export interface ResearchExecutorPolicy {
  backend: 'remote_http' | 'local_gpu';
  maxBudgetUSD: number;
  maxRuntimeMinutes: number;
  allowNetwork: boolean;
}

export interface WorkflowGovernanceReport {
  route: WorkflowRouteName;
  lane: WorkflowLane;
  computePool: WorkflowComputePool;
  executorPolicy?: ResearchExecutorPolicy;
  estimatedBudgetUSD: number | null;
  estimatedRuntimeMinutes: number | null;
  requiresNetwork: boolean;
  executionDecision: Exclude<GovernanceDecision, 'not_applicable'>;
  releaseDecision: GovernanceDecision;
  gates: {
    budget: GovernanceGateResult;
    runtime: GovernanceGateResult;
    safety: GovernanceGateResult;
    release: GovernanceGateResult;
  };
  recoveryStrategy: string;
  createdAt: string;
}

function extractFirstNumber(match: RegExpMatchArray | null): number | null {
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function inferBudgetUSD(
  inputText: string,
  route: WorkflowRouteName
): number | null {
  const directMatch =
    inputText.match(/\$([\d.]+)/) ||
    inputText.match(/预算(?:不超过|上限|控制在|为)?\s*([\d.]+)\s*(?:usd|美元|刀)/i) ||
    inputText.match(/([\d.]+)\s*(?:usd|美元|刀)\s*(?:预算|以内|上限)/i);
  const directBudget = extractFirstNumber(directMatch);
  if (directBudget !== null) {
    return directBudget;
  }

  switch (route) {
    case 'research_run_request':
      return 20;
    case 'research_plan':
      return 8;
    default:
      return null;
  }
}

function inferRuntimeMinutes(
  inputText: string,
  route: WorkflowRouteName
): number | null {
  const hourMatch =
    inputText.match(/([\d.]+)\s*(?:小时|h|hr|hrs|hour|hours)/i);
  const minuteMatch =
    inputText.match(/([\d.]+)\s*(?:分钟|min|mins|minute|minutes)/i);

  const hours = extractFirstNumber(hourMatch);
  if (hours !== null) {
    return Math.round(hours * 60);
  }

  const minutes = extractFirstNumber(minuteMatch);
  if (minutes !== null) {
    return Math.round(minutes);
  }

  switch (route) {
    case 'research_run_request':
      return 180;
    case 'research_plan':
      return 45;
    default:
      return null;
  }
}

function inferNetworkRequirement(inputText: string): boolean {
  return /联网|网络|internet|online|web|crawl|爬虫|抓取|搜索网页|remote api/i.test(
    inputText
  );
}

function getReleaseGate(route: WorkflowRouteName): GovernanceGateResult {
  if (route === 'article_create' || route === 'article_edit' || route === 'paper_rewrite') {
    return {
      decision: 'manual_review',
      summary: '发布门保留人工确认，当前 lane 只负责生成草稿与 artifacts',
    };
  }

  return {
    decision: 'not_applicable',
    summary: '当前 workflow 不直接触发发布动作',
  };
}

function buildRecoveryStrategy(
  lane: WorkflowLane,
  policy?: ResearchExecutorPolicy
): string {
  if (lane !== 'research' || !policy) {
    return '当前 lane 不需要 executor failure recovery。';
  }

  if (policy.backend === 'local_gpu') {
    return 'local_gpu 失败后可基于 executor-request.json 重新生成 queue ticket，并由 worker 继续消费。';
  }

  return 'remote_http 失败后可轮询 /research-runs/:runId，并基于 executor-request.json 重新提交。';
}

export function assignWorkflowComputePool(
  lane: WorkflowLane,
  route: WorkflowRouteName
): WorkflowComputePool {
  if (lane === 'writing' || route === 'article_create' || route === 'article_edit') {
    return 'writing_batch';
  }

  if (
    lane === 'research' ||
    route === 'research_idea' ||
    route === 'research_plan' ||
    route === 'research_run_request' ||
    route === 'paper_rewrite'
  ) {
    return 'research_sandbox';
  }

  return 'wechat_realtime';
}

export function evaluateWorkflowGovernance(options: {
  route: WorkflowRouteName;
  lane: WorkflowLane;
  inputText: string;
  executorPolicy?: ResearchExecutorPolicy;
}): WorkflowGovernanceReport {
  const computePool = assignWorkflowComputePool(options.lane, options.route);
  const estimatedBudgetUSD = inferBudgetUSD(options.inputText, options.route);
  const estimatedRuntimeMinutes = inferRuntimeMinutes(options.inputText, options.route);
  const requiresNetwork = inferNetworkRequirement(options.inputText);
  const release = getReleaseGate(options.route);

  const budget: GovernanceGateResult =
    options.executorPolicy && estimatedBudgetUSD !== null
      ? estimatedBudgetUSD > options.executorPolicy.maxBudgetUSD
        ? {
            decision: 'manual_review',
            summary: `预算预估 ${estimatedBudgetUSD} USD 超过当前上限 ${options.executorPolicy.maxBudgetUSD} USD`,
          }
        : {
            decision: 'pass',
            summary: `预算预估 ${estimatedBudgetUSD} USD 在当前上限 ${options.executorPolicy.maxBudgetUSD} USD 内`,
          }
      : {
          decision: options.executorPolicy ? 'pass' : 'not_applicable',
          summary: options.executorPolicy
            ? '未显式指定预算，沿用 executor 默认预算策略'
            : '当前 workflow 不使用 research executor 预算门',
        };

  const runtime: GovernanceGateResult =
    options.executorPolicy && estimatedRuntimeMinutes !== null
      ? estimatedRuntimeMinutes > options.executorPolicy.maxRuntimeMinutes
        ? {
            decision: 'manual_review',
            summary: `运行时预估 ${estimatedRuntimeMinutes} 分钟 超过当前上限 ${options.executorPolicy.maxRuntimeMinutes} 分钟`,
          }
        : {
            decision: 'pass',
            summary: `运行时预估 ${estimatedRuntimeMinutes} 分钟 在当前上限 ${options.executorPolicy.maxRuntimeMinutes} 分钟内`,
          }
      : {
          decision: options.executorPolicy ? 'pass' : 'not_applicable',
          summary: options.executorPolicy
            ? '未显式指定运行时，沿用 executor 默认时长策略'
            : '当前 workflow 不使用 research executor 运行时门',
        };

  const safety: GovernanceGateResult =
    options.executorPolicy
      ? requiresNetwork && !options.executorPolicy.allowNetwork
        ? {
            decision: 'blocked',
            summary: '请求包含联网/抓取意图，但当前 sandbox policy 禁止网络访问',
          }
        : {
            decision: 'pass',
            summary: requiresNetwork
              ? '当前 executor policy 允许联网，但仍需在 sandbox 中执行'
              : '当前请求不需要联网，可在 sandbox 中执行',
          }
      : {
          decision: options.lane === 'research' ? 'manual_review' : 'pass',
          summary:
            options.lane === 'research'
              ? '研究 lane 尚未提供 executor policy，需人工确认安全边界'
              : '当前 workflow 不触发代码执行 sandbox 风险',
        };

  const executionDecision: Exclude<GovernanceDecision, 'not_applicable'> =
    [budget, runtime, safety].some(item => item.decision === 'blocked')
      ? 'blocked'
      : [budget, runtime, safety].some(item => item.decision === 'manual_review')
        ? 'manual_review'
        : 'pass';

  return {
    route: options.route,
    lane: options.lane,
    computePool,
    executorPolicy: options.executorPolicy,
    estimatedBudgetUSD,
    estimatedRuntimeMinutes,
    requiresNetwork,
    executionDecision,
    releaseDecision: release.decision,
    gates: {
      budget,
      runtime,
      safety,
      release,
    },
    recoveryStrategy: buildRecoveryStrategy(options.lane, options.executorPolicy),
    createdAt: new Date().toISOString(),
  };
}

export function formatGovernanceSummary(
  report: WorkflowGovernanceReport
): string[] {
  const lines = [
    `Compute pool: ${report.computePool}`,
    `执行门: ${report.executionDecision}`,
    `发布门: ${report.releaseDecision}`,
  ];

  if (report.estimatedBudgetUSD !== null) {
    lines.push(`预算预估: ${report.estimatedBudgetUSD} USD`);
  }

  if (report.estimatedRuntimeMinutes !== null) {
    lines.push(`运行时预估: ${report.estimatedRuntimeMinutes} min`);
  }

  lines.push(`联网需求: ${report.requiresNetwork ? 'yes' : 'no'}`);
  return lines;
}

export async function persistWorkflowGovernanceArtifacts(options: {
  userId: string;
  jobId: string;
  report: WorkflowGovernanceReport;
}): Promise<ResearchArtifactSpec[]> {
  const artifactDir = path.join(
    storage.sessionsDir,
    options.userId,
    'artifacts',
    options.jobId,
    'governance'
  );
  await fs.ensureDir(artifactDir);

  const reportPath = path.join(artifactDir, 'governance-report.json');
  const releaseGatePath = path.join(artifactDir, 'release-gate.json');

  await fs.writeJson(reportPath, options.report, { spaces: 2 });
  await fs.writeJson(
    releaseGatePath,
    {
      route: options.report.route,
      releaseDecision: options.report.releaseDecision,
      gate: options.report.gates.release,
      createdAt: options.report.createdAt,
    },
    { spaces: 2 }
  );

  return [
    {
      kind: 'workflow_governance_report',
      label: 'Workflow governance report',
      path: reportPath,
      summary: `${options.report.route} 的预算 / 运行时 / 安全门评估`,
    },
    {
      kind: 'workflow_release_gate',
      label: 'Workflow release gate',
      path: releaseGatePath,
      summary: options.report.gates.release.summary,
    },
  ];
}
