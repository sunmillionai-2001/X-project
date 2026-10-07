// Synthetic research input only. These authors, quotations and metrics are not real X observations.
export function researchFixture() {
  return {
    criteria: '合成测试样本，不用于真实发布或运营判断。',
    studies: ['FixtureOne', 'FixtureTwo'].map((handle, n) => {
      const postId = String(100101 + n);
      const quote = '合成参考原文';
      return {
        id: 'low-' + postId, postId, handle, author: '合成测试作者 ' + (n + 1),
        url: `https://x.com/${handle}/status/${postId}`,
        title: '合成结构示例', originalTitle: '合成测试参考', format: '文字测试样本',
        publishedAt: '2026-01-01T00:00:00Z', checkedAt: '2026-01-04T00:00:00Z',
        followers: 120 + n, followersAtPublication: null,
        followersCheckedAt: '2026-01-04T00:00:00Z', followersSource: `https://x.com/${handle}`,
        metrics: { views: 10000, likes: 200, bookmarks: 300, replies: 10, reposts: 5 },
        referenceText: '合成参考原文，只用于隔离测试，不代表真实作者、经历或运营效果。'.repeat(8),
        contentStatus: 'post_text', referenceKind: 'curated-low-follower',
        takeaway: '用自己的材料说明问题和步骤。', readerTask: '完成一项合成测试任务。',
        hookSummary: '开头提出具体问题。', evidence: [{ quote }],
        structure: ['问题', '条件', '步骤', '核对'].map((role, i) => ({ id: 'structure-' + (i + 1), role,
          instruction: '填写自己的材料并注明限制。', template: '{读者} 在 {场景} 使用 {材料}。' })),
        layout: 'flow', visualAdvice: '使用明确标注的原创流程示意图。', analysisScope: '只分析合成文字，图片未分析。',
        mechanism: { theory: '使用与满足研究', confidence: '中', explanation: '仅验证页面呈现。' },
        caveats: ['合成样本不能作为真实运营结论。'], ownTopic: '合成测试主题',
        analyzedBy: 'isolated-test-fixture', analysisAt: '2026-01-04T00:00:00Z',
        comparison: { sameFormatCount: 0, medianViews: null, posts: [], boundary: '测试中没有普通帖对照。' }
      };
    })
  };
}
