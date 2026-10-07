import test from 'node:test';
import assert from 'node:assert/strict';
import { initialViralForm, initializeViralForm, viralPage } from '../web/viral-view.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ui = { esc, date: v => v || '未知', link: (u, t) => `<a href="${esc(u)}">${esc(t)}</a>`, button: (t, a, attrs = '') => `<button data-action="${a}" ${attrs}>${t}</button>`, notice: t => `<div>${t}</div>` };
const insight = { id: 'gkxspace-1', dimension: 'style', title: '<script>注入</script>', observation: '文字观察', interpretation: '文本推断', adaptation: '自己的材料', confidence: 'medium', evidence: [{ postId: '1', quote: '具体的原句证据' }] };
const study = { id: 'study', createdAt: '2026-10-06', windowStart: '2026-09-24', windowEnd: '2026-10-06', profiles: [{ handle: 'gkxspace', name: '余温', insights: [insight] }], authors: [{ handle: 'gkxspace', name: '余温', samples: ['1'], rootCount: 4, usableCount: 4, metric: 'bookmarks', metricAvailable: 4, median: 20, reportStatus: 'ok' }], samples: [{ id: '1', handle: 'gkxspace', authorName: '余温', url: 'https://x.com/gkxspace/status/1', title: '样本', text: '具体的原句证据', role: '高表现样本', metrics: { bookmarks: 30 } }], comparisons: [], methods: { sources: ['dbs-spread'] }, limitations: ['真实范围'] };
const draft = { id: 'draft', studyId: 'study', topic: '主题', body: '草稿正文', titles: ['标题一', '标题二'], outline: '提纲', materials: [{ id: 'own', name: '材料', text: '材料原文', url: '' }], methodsUsed: [{ insightId: 'gkxspace-1', application: '通用结构' }], sourceNotes: [{ materialId: 'own', quote: '材料原文', use: '事实依据' }], verificationNotes: [], overlaps: [], images: [{ title: '图', prompt: '原创图提示词' }] };
const state = { x: { config: { accounts: [{ handle: 'gkxspace', name: '余温', enabled: true }] }, accounts: [{ handle: 'gkxspace', name: '余温', posts: [], fetchedAt: '2026-10-06', report: { status: 'ok' } }] }, viral: { studies: [study], drafts: [draft] } };
test('research and writing views render real references, escape model content and retain form selections', () => {
  const form = initialViralForm(); initializeViralForm(state, form);
  assert.deepEqual(form.handles, ['gkxspace']); assert.equal(form.studyId, 'study');
  const research = viralPage(state, form, ui); assert(research.includes('查看原帖证据')); assert(research.includes('&lt;script&gt;')); assert(!research.includes('<script>'));
  form.tab = 'write'; form.bodies.draft = '未保存的修改';
  const write = viralPage(state, form, ui); assert(write.includes('未保存的修改')); assert(write.includes('继续配图')); assert(write.includes('原创图提示词')); assert(write.includes('事实依据'));
});

test('API image mode offers inline generation while retaining copy, web generation and import', () => {
  const form = initialViralForm(); initializeViralForm(state, form); form.tab = 'write';
  const page = viralPage({ ...state, settings: { imageMode: 'api', imageCheck: { status: 'failed', message: '当前分组未开启图片生成 <script>' } } }, form, ui);
  assert(page.includes('使用 API 生成这张图')); assert(page.includes('一键生成全部配图')); assert(page.includes('配图制作'));
  assert(page.includes('当前分组未开启图片生成 &lt;script&gt;'));
  assert(page.includes('现有的 Plus')); assert(page.includes('打开 ChatGPT 网页 ↗')); assert(page.includes('复制这张图的提示词')); assert(page.includes('导入这张图片')); assert(!page.includes('<script>'));
});
test('saved draft pictures preview and download inline; stale pictures remain visibly historical', () => {
  const form=initialViralForm();initializeViralForm(state,form);form.tab='write';
  const asset={id:'image',file:'test.png',label:'封面',imageIndex:0,current:true,origin:'api',model:'gpt-image-2'};
  const page=viralPage({...state,settings:{imageMode:'api',imageModel:'gpt-image-2'},viral:{...state.viral,drafts:[{...draft,imageAssets:[asset],imagePromptsCurrent:true}]}},form,ui);
  assert(page.includes('/assets/test.png'));assert(page.includes('下载这张图片'));assert(page.includes('1/1 张已保存'));
  const stale=viralPage({...state,settings:{imageMode:'api'},viral:{...state.viral,drafts:[{...draft,imageAssets:[{...asset,current:false}],imagePromptsCurrent:false}]}},form,ui);
  assert(stale.includes('历史图片 · 1 张'));assert(stale.includes('正文有修改'));assert(stale.includes('data-action="viral-images" disabled'));
});
