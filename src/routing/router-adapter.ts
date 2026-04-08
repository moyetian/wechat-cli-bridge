import { WorkflowRouteDecision } from '../types';
import { WORKFLOW_ROUTE_DEFINITIONS } from './contract';

export interface RouterAdapter {
  route(input: string): Promise<WorkflowRouteDecision>;
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function containsAny(input: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(input));
}

const ARTICLE_CREATE_PATTERNS = [
  /写.*公众号文章/,
  /写.*文章/,
  /生成.*公众号文章/,
];

const ARTICLE_EDIT_PATTERNS = [
  /改写.*文章/,
  /润色.*文章/,
  /重写.*文章/,
];

const ARTICLE_TOPIC_PATTERNS = [
  /主题\s*(?:是|为|:|：)\s*.+/,
  /关于.+(?:的)?(?:公众号文章|文章)/,
];

const RESEARCH_IDEA_PATTERNS = [
  /研究(选题|方向|想法|题目|课题)/,
  /给我.*研究.*想法/,
];

const RESEARCH_PLAN_PATTERNS = [
  /研究计划/,
  /实验计划/,
  /可行性/,
  /预算/,
  /novelty/i,
];

const RESEARCH_RUN_PATTERNS = [
  /开始跑实验/,
  /开始研究/,
  /启动实验/,
  /开跑/,
  /运行实验/,
];

const PAPER_REWRITE_PATTERNS = [
  /润色.*论文/,
  /改写.*论文/,
  /重写.*论文/,
  /rewrite.*paper/i,
];

const STATUS_PATTERNS = [
  /进度/,
  /状态/,
  /\bstatus\b/i,
];

function buildClarifyDecision(
  summary: string,
  rationale: string,
  message: string
): WorkflowRouteDecision {
  return {
    kind: 'clarify',
    summary,
    rationale,
    message,
  };
}

export class HeuristicRouterAdapter implements RouterAdapter {
  async route(input: string): Promise<WorkflowRouteDecision> {
    const normalized = normalizeWhitespace(input);

    if (!normalized) {
      return buildClarifyDecision(
        '输入为空，无法决定工作流',
        'empty_input',
        '⚠️ 你还没有提供具体任务。'
      );
    }

    if (containsAny(normalized, STATUS_PATTERNS) && /(研究|文章|workflow|任务)/i.test(normalized)) {
      const route = WORKFLOW_ROUTE_DEFINITIONS.status_query;
      return {
        kind: 'workflow',
        route: route.route,
        lane: route.lane,
        gate: route.gate,
        summary: route.summary,
        rationale: 'matched_status_query',
      };
    }

    if (containsAny(normalized, PAPER_REWRITE_PATTERNS)) {
      const route = WORKFLOW_ROUTE_DEFINITIONS.paper_rewrite;
      return {
        kind: 'workflow',
        route: route.route,
        lane: route.lane,
        gate: route.gate,
        summary: route.summary,
        rationale: 'matched_paper_rewrite',
      };
    }

    if (containsAny(normalized, RESEARCH_RUN_PATTERNS)) {
      const route = WORKFLOW_ROUTE_DEFINITIONS.research_run_request;
      return {
        kind: 'workflow',
        route: route.route,
        lane: route.lane,
        gate: route.gate,
        summary: route.summary,
        rationale: 'matched_research_run_request',
      };
    }

    if (containsAny(normalized, RESEARCH_PLAN_PATTERNS)) {
      const route = WORKFLOW_ROUTE_DEFINITIONS.research_plan;
      return {
        kind: 'workflow',
        route: route.route,
        lane: route.lane,
        gate: route.gate,
        summary: route.summary,
        rationale: 'matched_research_plan',
      };
    }

    if (containsAny(normalized, RESEARCH_IDEA_PATTERNS)) {
      const route = WORKFLOW_ROUTE_DEFINITIONS.research_idea;
      return {
        kind: 'workflow',
        route: route.route,
        lane: route.lane,
        gate: route.gate,
        summary: route.summary,
        rationale: 'matched_research_idea',
      };
    }

    if (containsAny(normalized, ARTICLE_EDIT_PATTERNS)) {
      const route = WORKFLOW_ROUTE_DEFINITIONS.article_edit;
      return {
        kind: 'workflow',
        route: route.route,
        lane: route.lane,
        gate: route.gate,
        summary: route.summary,
        rationale: 'matched_article_edit',
      };
    }

    if (containsAny(normalized, ARTICLE_CREATE_PATTERNS)) {
      if (!containsAny(normalized, ARTICLE_TOPIC_PATTERNS)) {
        return buildClarifyDecision(
          '公众号文章请求缺少主题',
          'article_topic_missing',
          '⚠️ 我知道你是想创建文章 workflow，但还缺少明确主题。请补一句：`主题是 ...` 或 `写一篇关于 ... 的文章`。'
        );
      }

      const route = WORKFLOW_ROUTE_DEFINITIONS.article_create;
      return {
        kind: 'workflow',
        route: route.route,
        lane: route.lane,
        gate: route.gate,
        summary: route.summary,
        rationale: 'matched_article_create',
      };
    }

    return {
      kind: 'passthrough',
      route: WORKFLOW_ROUTE_DEFINITIONS.general_cli_task.route,
      lane: WORKFLOW_ROUTE_DEFINITIONS.general_cli_task.lane,
      gate: WORKFLOW_ROUTE_DEFINITIONS.general_cli_task.gate,
      summary: WORKFLOW_ROUTE_DEFINITIONS.general_cli_task.summary,
      rationale: 'fallback_general_cli',
    };
  }
}
