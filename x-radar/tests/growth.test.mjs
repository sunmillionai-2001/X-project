import test from 'node:test';
import assert from 'node:assert/strict';
import { growthLibrary, growthReferences, validateGrowthAnalysis, analysisStudy, ownCreationInput, metricRecord, xPostURL } from '../growth.mjs';
import { validateCreation } from '../viral.mjs';
import { researchFixture } from './growth-fixture.mjs';
test('references use own root and article body, excluding quote and reply evidence', () => {
  const p = { id: '123', own: true, kind: 'post', body: '作者开头'.repeat(30), article: { body: '已取得长文正文'.repeat(40) }, quote: { body: '别人文字不可归因' }, url: 'https://x.com/Study/status/123', publishedAt: '2026-10-01T00:00:00Z' };
  const refs = growthReferences([{ handle:'Study', name:'测试作者', posts:[p, {...p,id:'124',replyToId:'123'}, {...p,id:'125',own:false}], pinned:p }]);
  assert.equal(refs.length,1); assert(refs[0].text.includes('已取得长文正文')); assert(!refs[0].text.includes('别人文字')); assert.equal(refs[0].isPinned,true);
});
test('curated low-follower references retain captured author text without needing a watched account', () => {
  const studies = researchFixture().studies;
  assert.equal(studies.length, 2);
  const refs = growthReferences([], studies);
  assert.equal(refs.length, studies.length);
  for (const s of studies) {
    const r = refs.find(r => r.id === s.postId);
    assert.equal(r.text, s.referenceText);
    assert.equal(r.referenceKind, 'curated-low-follower');
    assert.equal(s.followersAtPublication, null);
    assert(s.followers > 0 && s.followers <= 5000);
    assert(s.followersCheckedAt && s.checkedAt && s.followersSource.endsWith(s.handle));
    for (const evidence of s.evidence) assert(r.text.includes(evidence.quote));
    assert.equal(validateGrowthAnalysis(s, r).structure.length, 4);
    if (s.comparison.sameFormatCount < 3) assert.equal(s.comparison.medianViews, null);
  }
  const duplicate = { ...studies[0], postId: studies[1].postId };
  assert.equal(growthReferences([], [...studies, duplicate]).length, studies.length);
});
const ref = { id:'123', handle:'Study', text:'逐字引用真实原句。'.repeat(15) };
const result = () => ({ title:'结构测试', readerTask:'读者任务', hookSummary:'开头分析', structure:['问题','方法','限制'].map(role => ({role,instruction:'使用自己的材料',template:'{场景} 的 {方法}'})), evidence:[{quote:'逐字引用真实原句'}], layout:'flow', visualAdvice:'统一流程图', caveats:['只有文字样本'] });
test('analysis rejects fabricated quotations, long quotations and empty template slots', () => {
  const good = validateGrowthAnalysis(result(),ref); assert.equal(analysisStudy({...good,reference:ref}).profiles[0].insights.length,3);
  assert.throws(() => validateGrowthAnalysis({...result(),evidence:[{quote:'不存在的真实原句'}]},ref),/不在/);
  assert.throws(() => validateGrowthAnalysis({...result(),evidence:[{quote:ref.text.slice(0,30)}]},ref),/过长/);
  assert.throws(() => validateGrowthAnalysis({...result(),structure:result().structure.map(s => ({...s,template:'照着这个句子写'}))},ref),/占位符/);
});
test('new facts must be supplied separately; source citations cannot use reference as factual material', () => {
  assert.throws(() => ownCreationInput({topic:'有效主题',ownAngle:'这是足够详细的自己的角度',ownMaterial:'太短'}),/100/);
  const input = ownCreationInput({topic:'有效主题',ownAngle:'这是足够详细的自己的角度',ownMaterial:'自己的材料内容。'.repeat(20)});
  assert.equal(input.materials.length,1); assert.equal(input.materials[0].id,'own-material');
  const study=analysisStudy({...validateGrowthAnalysis(result(),ref),reference:ref});
  const draft={body:'隔离验收用原创内容，不代表真实个人体验。'.repeat(55),titles:['标题一','标题二'],outline:'问题\n方法\n边界',methodsUsed:[{insightId:'structure-1',application:'使用问题结构'}],sourceNotes:[{materialId:ref.id,quote:ref.text.slice(0,8),use:'违规引用参考为事实'}],verificationNotes:[],images:[{title:'封面',prompt:'示意图'},{title:'正文',prompt:'流程图'}]};
  assert.throws(() => validateCreation(draft,input.materials,study),/不存在的材料/);
});
test('metric snapshots preserve unknowns and ages, reject login links and impossible times', () => {
  const d={url:'https://x.com/Study/status/123?utm_source=test',title:'数据测试',publishedAt:'2026-10-01T00:00:00Z',observedAt:'2026-10-04T00:00:00Z',views:'100',bookmarks:'0',follows:''};
  const r=metricRecord(d,Date.parse('2026-10-06T00:00:00Z'));
  assert.equal(r.ageHours,72); assert.equal(r.bookmarks,0); assert.equal(r.follows,null); assert.equal(r.bookmarkRate,0); assert.equal(r.url,'https://x.com/Study/status/123');
  assert.equal(metricRecord({...d,views:''},Date.parse('2026-10-06T00:00:00Z')).bookmarkRate,null);
  assert.throws(() => metricRecord({...d,views:true}),/非负整数/);
  assert.throws(() => metricRecord({...d,observedAt:'2026-09-30T00:00:00Z'}),/发布时间/);
  assert.throws(() => xPostURL('https://x.com/login'),/完整/);
});
test('every library method resolves to a real source and pinned code evidence', () => {
  const ids = new Set([...growthLibrary.repositories,...growthLibrary.articles].map(s => s.id));
  for(const m of growthLibrary.methods) for(const id of m.sources) assert(ids.has(id),id);
  for(const r of growthLibrary.repositories) { assert(r.evidence.length); for(const e of r.evidence) assert(e.url.includes(r.commit)); }
});
