import {
  WorkflowGateLevel,
  WorkflowLane,
  WorkflowRouteDefinition,
  WorkflowRouteName,
} from '../types';

export const WORKFLOW_ROUTE_DEFINITIONS: Record<
  WorkflowRouteName,
  WorkflowRouteDefinition
> = {
  article_create: {
    route: 'article_create',
    lane: 'writing',
    gate: 'none',
    summary: '创建新的公众号文章工作流',
  },
  article_edit: {
    route: 'article_edit',
    lane: 'writing',
    gate: 'none',
    summary: '编辑或润色现有文章工作流',
  },
  research_idea: {
    route: 'research_idea',
    lane: 'research',
    gate: 'none',
    summary: '生成研究想法或选题',
  },
  research_plan: {
    route: 'research_plan',
    lane: 'research',
    gate: 'review_required',
    summary: '生成研究计划、预算或可行性分析',
  },
  research_run_request: {
    route: 'research_run_request',
    lane: 'research',
    gate: 'approval_required',
    summary: '请求启动高成本研究执行工作流',
  },
  paper_rewrite: {
    route: 'paper_rewrite',
    lane: 'research',
    gate: 'review_required',
    summary: '润色或重写论文草稿',
  },
  status_query: {
    route: 'status_query',
    lane: 'bridge',
    gate: 'none',
    summary: '查询工作流状态',
  },
  approval_decision: {
    route: 'approval_decision',
    lane: 'bridge',
    gate: 'none',
    summary: '处理审批决策',
  },
  general_cli_task: {
    route: 'general_cli_task',
    lane: 'general_cli',
    gate: 'none',
    summary: '继续走现有 CLI agent 执行路径',
  },
};

export function getWorkflowGateLabel(gate: WorkflowGateLevel): string {
  switch (gate) {
    case 'none':
      return 'direct';
    case 'review_required':
      return 'review';
    case 'approval_required':
      return 'approval';
  }
}

export function getWorkflowLaneLabel(lane: WorkflowLane): string {
  switch (lane) {
    case 'general_cli':
      return 'general-cli';
    case 'writing':
      return 'writing';
    case 'research':
      return 'research';
    case 'bridge':
      return 'bridge';
  }
}
