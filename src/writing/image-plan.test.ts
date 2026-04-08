import { buildArticleImagePlan } from './image-plan';

describe('buildArticleImagePlan', () => {
  it('should derive cover and inline image slots from article draft markdown', () => {
    const plan = buildArticleImagePlan({
      topic: '多Agent协作与控制平面',
      draftMarkdown: [
        '# 标题建议',
        '',
        '# 多Agent不是多开几个Bot：你真正需要的是一套控制平面',
        '',
        '这是一段导语，用来解释文章主题。',
        '',
        '## 一、什么叫多Agent控制平面？',
        '这一节定义了控制平面的核心职责。',
        '',
        '## 二、为什么协作系统需要治理？',
        '这一节强调了可观测性与治理的重要性。',
      ].join('\n'),
    });

    expect(plan.title).toBe('多Agent不是多开几个Bot：你真正需要的是一套控制平面');
    expect(plan.slots).toHaveLength(3);
    expect(plan.slots[0].placement).toBe('cover');
    expect(plan.slots[1].targetHeading).toBe('一、什么叫多Agent控制平面？');
    expect(plan.slots[2].targetHeading).toBe('二、为什么协作系统需要治理？');
  });
});
