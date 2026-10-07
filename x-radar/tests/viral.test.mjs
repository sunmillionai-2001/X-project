import test from 'node:test';
import assert from 'node:assert/strict';
import { authorText, studySamples, validateStudy, validateCreation, viralProject } from '../viral.mjs';
import { hash } from '../core.mjs';
const at = Date.now();
const posts = Array.from({ length: 10 }, (_, n) => ({ id: String(n + 100), author: 'StudyAI', own: true, body: `这是作者自己的测试文字，第${n}篇讨论普通人的具体问题与操作方法。`, url: 'https://x.com/StudyAI/status/' + (n + 100), publishedAt: new Date(at - (n + 1) * 3600000).toISOString(), fetchedAt: new Date(at).toISOString(), metrics: { bookmarks: 100 - n * 10, views: null, likes: 3 }, quote: { author: 'Other', body: '被引用作者独有的文字，不可当成观察作者的文风' } }));
const account = { handle: 'StudyAI', name: '测试作者', posts, report: { status: 'partial' }, pinned: { ...posts[0], id: 'old', publishedAt: new Date(at - 30 * 86400000).toISOString() } };
const bundle = studySamples([account], ['studyai'], at);
const report = () => ({ profiles: [{ handle: 'StudyAI', insights: ['style', 'structure', 'method', 'operation'].map(dimension => ({ dimension, title: '测试', observation: '可见文字结构', interpretation: '文本推断', adaptation: '用自己的材料', confidence: 'medium', evidence: [{ postId: '100', quote: '这是作者自己的测试文字' }] })) }], comparisons: [] });
test('research samples include performance contrasts, recent context and separately dated pin; quotes stay attributed', () => {
  assert.equal(bundle.samples.length, 7); assert.equal(bundle.authors[0].rootCount, 10);
  assert(bundle.samples.some(s => s.role === '高表现样本')); assert(bundle.samples.some(s => s.role === '低位对照样本'));
  assert.equal(bundle.samples.find(s => s.id === 'old').rank, null);
  assert(!authorText(posts[0]).includes('被引用作者独有'));
  assert(bundle.limitations.some(s => s.includes('缺口')));
  const noMetrics = { ...account, posts: posts.map(p => ({ ...p, metrics: { bookmarks: null, views: null, likes: null } })) };
  assert.equal(studySamples([noMetrics], ['StudyAI'], at).authors[0].metric, null);
  assert.throws(() => studySamples([{ ...account, posts: posts.slice(0, 2) }], ['StudyAI'], at), /至少需要 3/);
});
test('study rejects invented evidence, other author quotes and missing dimensions', () => {
  assert.equal(validateStudy(report(), bundle).profiles[0].insights.length, 4);
  const broader = report(); broader.comparisons = [{ title: '多样本比较', observation: '对比四条样本', adaptation: '保留具体结构', evidence: bundle.samples.slice(0, 4).map(s => ({ postId: s.id, quote: s.text.slice(0, 15) })) }];
  assert.equal(validateStudy(broader, bundle).comparisons[0].evidence.length, 4);
  const fake = report(); fake.profiles[0].insights[0].evidence[0].quote = '被引用作者独有的文字';
  assert.throws(() => validateStudy(fake, bundle), /原句/);
  fake.profiles[0].insights[0].evidence[0].postId = 'missing'; assert.throws(() => validateStudy(fake, bundle), /未输入/);
  const missing = report(); missing.profiles[0].insights[0].dimension = 'audience'; assert.throws(() => validateStudy(missing, bundle), /缺少/);
});
test('creation ties method and fact references to input, enforces length and detects literal overlap', () => {
  const study = { ...bundle, ...validateStudy(report(), bundle) }, materials = [{ id: 'fact-1', text: '这是用户提供的实际观察记录，尚未独立核实。' }];
  const draft = { titles: ['标题甲', '标题乙'], body: '这是用于隔离验收的原创测试正文，不代表真实资讯和个人经历。'.repeat(35), outline: '提纲', methodsUsed: [{ insightId: 'studyai-1', application: '先讲具体问题' }], sourceNotes: [{ materialId: 'fact-1', quote: '这是用户提供的实际观察记录', use: '说明观察' }], verificationNotes: [], images: [{ title: '图甲', prompt: '示意图' }, { title: '图乙', prompt: '示意图' }] };
  assert(validateCreation(draft, materials, study).bodyHash);
  const generated = validateCreation(draft, materials, study);
  const edited = { ...generated, id: 'draft', topic: '主题', ownAngle: '自己的角度', materials, body: generated.body + '新增内容', versions: [{ body: generated.body }] };
  assert.notEqual(viralProject(edited).suggestedImagesBodyHash, hash(edited.body), 'Edited text must not reuse prompts bound to the old body');
  assert.throws(() => validateCreation({ ...draft, body: '太短' }, materials, study), /800/);
  assert.throws(() => validateCreation({ ...draft, sourceNotes: [{ materialId: 'fake', quote: '编造事实', use: '假' }] }, materials, study), /不存在/);
  assert.throws(() => validateCreation({ ...draft, methodsUsed: [{ insightId: 'fake', application: '假' }] }, materials, study), /不存在/);
});
