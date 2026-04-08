import {
  assignWorkflowComputePool,
  evaluateWorkflowGovernance,
} from './engine';

describe('governance engine', () => {
  it('should assign compute pools by lane', () => {
    expect(assignWorkflowComputePool('bridge', 'status_query')).toBe('wechat_realtime');
    expect(assignWorkflowComputePool('writing', 'article_create')).toBe('writing_batch');
    expect(assignWorkflowComputePool('research', 'research_run_request')).toBe('research_sandbox');
  });

  it('should block networked research runs when executor policy forbids network', () => {
    const report = evaluateWorkflowGovernance({
      route: 'research_run_request',
      lane: 'research',
      inputText: '联网抓取网页并跑 6 小时实验，预算 40 美元',
      executorPolicy: {
        backend: 'local_gpu',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 240,
        allowNetwork: false,
      },
    });

    expect(report.computePool).toBe('research_sandbox');
    expect(report.executionDecision).toBe('blocked');
    expect(report.gates.budget.decision).toBe('manual_review');
    expect(report.gates.runtime.decision).toBe('manual_review');
    expect(report.gates.safety.decision).toBe('blocked');
  });

  it('should keep article workflows executable while marking release gate as manual review', () => {
    const report = evaluateWorkflowGovernance({
      route: 'article_create',
      lane: 'writing',
      inputText: '写一篇关于 AI 路由的公众号文章',
    });

    expect(report.executionDecision).toBe('pass');
    expect(report.releaseDecision).toBe('manual_review');
    expect(report.gates.release.decision).toBe('manual_review');
  });
});
