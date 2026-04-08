import { HeuristicRouterAdapter } from './router-adapter';

describe('HeuristicRouterAdapter', () => {
  const adapter = new HeuristicRouterAdapter();

  it('should classify article creation requests with an explicit topic', async () => {
    const decision = await adapter.route('写一篇关于 AI 路由的公众号文章');

    expect(decision).toMatchObject({
      kind: 'workflow',
      route: 'article_create',
      lane: 'writing',
      gate: 'none',
    });
  });

  it('should ask for clarification on vague article creation requests', async () => {
    const decision = await adapter.route('帮我写一篇公众号文章');

    expect(decision.kind).toBe('clarify');
    expect(decision.message).toContain('缺少明确主题');
  });

  it('should classify research run requests as approval-required', async () => {
    const decision = await adapter.route('开始跑实验，研究小模型路由的上下文效率');

    expect(decision).toMatchObject({
      kind: 'workflow',
      route: 'research_run_request',
      lane: 'research',
      gate: 'approval_required',
    });
  });

  it('should classify research status queries', async () => {
    const decision = await adapter.route('当前研究进度怎么样？');

    expect(decision).toMatchObject({
      kind: 'workflow',
      route: 'status_query',
      lane: 'bridge',
    });
  });

  it('should pass through regular CLI tasks', async () => {
    const decision = await adapter.route('修改 src/app.ts 的登录逻辑');

    expect(decision).toMatchObject({
      kind: 'passthrough',
      route: 'general_cli_task',
      lane: 'general_cli',
    });
  });
});
