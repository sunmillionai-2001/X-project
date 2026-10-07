import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, validateCards, approveOutline, saveDraft, gateDraft, gateImages, svgCard } from '../core.mjs';
const source = { id: 'one', fingerprint: 'first', url: 'https://example.com/article' };
const card = { candidateIds: ['one'], title: '标题', eventKey: 'event', type: 'hot', reason: '原因', summary: '摘要', angles: ['角度一', '角度二'], outline: '提纲', needsTest: false, facts: [], unknowns: [], testSteps: [] };
test('rejects fabricated citations and duplicate events', () => {
  assert.throws(() => validateCards({ cards: [{ ...card, candidateIds: ['missing'] }] }, [source]), /不存在/);
  assert.throws(() => validateCards({ cards: [card, card] }, [source]), /重复/);
  assert.throws(() => validateCards({ cards: [card] }, [source], [{ eventKey: 'event', sources: [source] }]), /新进展/);
});
test('changing a confirmed draft invalidates its plan and retains versions', () => {
  const old = { draft: '旧正文', versions: [], plan: ['旧方案'], draftApproved: true, planApproved: true, completedAt: 'done' };
  const next = saveDraft(old, '新正文');
  assert.equal(next.draftApproved, false); assert.equal(next.plan, null); assert.equal(next.completedAt, null); assert.equal(next.versions[0].body, '新正文');
  assert.throws(() => gateImages(next), /确认/);
});
test('outline change revokes test evidence approval and cannot bypass test gate', () => {
  const old = { angle: '旧角度', outline: '旧提纲', card: { needsTest: true }, testApproved: true, startedAt: new Date().toISOString() };
  const next = approveOutline(old, { angle: '新角度', outline: '新提纲' });
  assert.equal(next.stage, 'testing'); assert.equal(next.testApproved, false); assert.throws(() => gateDraft(next), /实测/);
});
test('plan approval is bound to draft content', () => {
  const p = { draft: '正文', draftApproved: true, planApproved: true, planHash: hash('另一个正文') };
  assert.throws(() => gateImages(p), /确认/);
  p.planHash = hash(p.draft); assert.doesNotThrow(() => gateImages(p));
});
test('information diagrams escape source text and label illustration status', () => {
  const svg = svgCard({ title: '<script>', points: ['<image href="evil">'] });
  assert(!svg.includes('<script>')); assert(svg.includes('&lt;script&gt;')); assert(svg.includes('示意图'));
});
