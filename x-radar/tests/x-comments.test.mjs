import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeXPost } from '../x-source.mjs';
import { collectXComments, publicComments } from '../x-comments.mjs';
import { xCommentsPanel } from '../web/x-source-view.js';
import { anonymousXJSON } from '../x-public-network.mjs';

const ms = Date.now() - 3600000;
const raw = (n, fields = {}) => ({ id: ((BigInt(ms + n * 1000 - 1288834974657) << 22n) + BigInt(n)).toString(),
  text: '公开测试评论 ' + n, created_timestamp: Math.floor((ms + n * 1000) / 1000),
  author: { screen_name: n ? 'Reader' + n : 'Alice', name: '合成作者' }, likes: n, ...fields });
const rootRaw = raw(0, { replies: 99 }), root = normalizeXPost(rootRaw, 'Alice');
const c = (n, parent = root.id, fields = {}) => raw(n, { replying_to: { status: parent, screen_name: 'Alice' }, ...fields });

test('merge rankings, resume search after conversation pagination failure and verify nested parents', async () => {
  const one = c(1), two = c(2), parent = c(4), child = c(3, parent.id), missing = c(8), orphan = c(7, missing.id);
  const unrelated = c(9, raw(20).id), hidden = c(10, root.id, { author: { screen_name: 'PrivateUser', protected: true } });
  const urls = [], saves = [];
  const fetchJSON = async value => {
    const u = new URL(value); urls.push(u);
    assert.equal(u.origin, 'https://api.fxtwitter.com');
    if (u.pathname.includes('/conversation/')) {
      if (u.searchParams.has('cursor')) throw Error('HTTP 404');
      return { data: { code: 200, status: rootRaw, replies: u.searchParams.get('ranking_mode') === 'likes' ? [two, one] : [one], cursor: { bottom: 'broken-page' } } };
    }
    if (u.pathname === '/2/search') {
      assert(u.searchParams.get('q').startsWith('conversation_id:' + root.id));
      if (u.searchParams.get('feed') === 'top') return { data: { code: 200, results: [two, orphan, unrelated, hidden] } };
      return { data: { code: 200, results: u.searchParams.has('cursor') ? [parent] : [child, two], cursor: { bottom: u.searchParams.has('cursor') ? null : 'search-next' } } };
    }
    return { data: { code: 200, tweet: u.pathname.endsWith(missing.id) ? missing : raw(20) } };
  };
  let out = await collectXComments(root, { fetchJSON, maxRequests: 4, onCheckpoint: async r => saves.push(structuredClone(r)) });
  assert(out.report.canContinue); assert(out.report.budgetReached);
  assert.equal(out.report.count, 2); assert.equal(saves[0].comments.length, 1);
  const before = urls.length;
  out = await collectXComments(root, { fetchJSON, previous: out });
  assert(urls.slice(before).some(u => u.searchParams.get('cursor') === 'search-next'));
  assert(!urls.slice(before).some(u => u.pathname === '/2/search' && u.searchParams.get('feed') === 'latest' && u.searchParams.get('q') === 'conversation_id:' + root.id && !u.searchParams.has('cursor')), 'resume must use saved cursor');
  assert.deepEqual(new Set(out.comments.map(p => p.id)), new Set([one, two, child, parent, orphan, missing].map(p => p.id)));
  assert(!out.comments.some(p => p.id === unrelated.id || p.id === hidden.id));
  assert.equal(out.report.reportedReplies, 99); assert.equal(out.report.newCount, 4);
  assert.equal(out.report.errors.length, 2); assert.equal(out.report.status, 'partial');
  assert(out.comments.find(p => p.id === two.id).sources.length >= 2);
  assert(!('checkpoints' in publicComments(out))); assert(!('pending' in publicComments(out)));
});

test('retain evidence on failure, detect stalled cursors and retain edited text and metric history on refresh', async () => {
  const first = c(1);
  const fetchJSON = async value => {
    const u = new URL(value), conversation = u.pathname.includes('/conversation/');
    return { data: { code: 200, [conversation ? 'replies' : 'results']: [first], cursor: { bottom: 'stalled' } } };
  };
  const out = await collectXComments(root, { fetchJSON });
  assert.equal(out.report.count, 1); assert.equal(out.report.requestsThisRun, out.checkpoints.length * 2);
  assert.equal(out.report.status, 'partial'); assert(out.report.errors.every(e => e.message.includes('未推进')));
  const failed = await collectXComments(root, { previous: out, refresh: true, fetchJSON: async () => { throw Error('network unavailable'); } });
  assert.equal(failed.comments.length, 1); assert.equal(failed.comments[0].body, first.text);
  const updated = await collectXComments(root, { previous: failed, refresh: true, fetchJSON: async value => ({ data: { code: 200,
    [new URL(value).pathname.includes('/conversation/') ? 'replies' : 'results']: [{ ...first, text: '修改后的评论', likes: 123 }] } }) });
  assert.equal(updated.comments.length, 1); assert.equal(updated.comments[0].versions.length, 1);
  assert.equal(updated.comments[0].versions[0].previousBody, first.text);
  assert.equal(updated.comments[0].metricSnapshots.length, 2);
  assert.equal(updated.report.status, 'traversed');
});

test('comment UI escapes public text and does not label cached counts as complete', () => {
  const snapshot = { comments: [{ ...normalizeXPost(c(1), null), body: '<script>alert(1)</script>' }], report: {
    count: 1, newCount: 1, totalPages: 2, reportedReplies: 100, lastSavedAt: new Date().toISOString(), canContinue: true,
    routes: [], errors: [{ source: '<img>', message: '<b>bad</b>' }], notice: '合成测试' } };
  const html = xCommentsPanel(root, { handle: 'Alice' }, snapshot);
  assert(html.includes('继续补全评论')); assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('<script>')); assert(!html.includes('<img>'));
  assert(!html.includes('已取得全部评论'));
});

test('retry transient failures, stop empty search pages, persist rate limits and split dates', async () => {
  const attempts = new Map(), seen = [];
  const out = await collectXComments(root, { fetchJSON: async value => {
    const u = new URL(value); seen.push(u); const key = u.pathname + u.searchParams.get('feed') + u.searchParams.get('ranking_mode') + u.searchParams.get('q');
    const n = (attempts.get(key) || 0) + 1; attempts.set(key, n);
    if (u.pathname.includes('/conversation/')) {
      if (n === 1) throw Error('fetch failed');
      return { data: { code: 200, replies: [c(1)] } };
    }
    return { data: { code: 200, results: [], cursor: { bottom: 'empty-' + n } } };
  } });
  assert.equal(out.report.count, 1); assert.equal(out.report.errors.length, 0);
  assert.equal(out.report.status, 'traversed'); assert(out.report.requestsThisRun <= 14);
  assert(seen.some(u => /since:\d{4}-\d\d-\d\d until:\d{4}-\d\d-\d\d/.test(u.searchParams.get('q'))));
  const until = new Date(Date.now() + 900000).toISOString();
  const limited = await collectXComments(root, { previous: out, refresh: true, fetchJSON: async () => {
    const e = new Error('429'); e.rateLimited = true; e.retryAt = until; throw e;
  } });
  assert.equal(limited.report.requestsThisRun, 1); assert.equal(limited.report.retryAt, until);
  assert.equal(limited.report.count, 1);
});

test('anonymous transport accepts only known public routes and sends no session headers', async () => {
  process.env.XRADAR_PUBLIC_PROXY = 'off';
  let calls = 0;
  const remote = async (url, options) => { calls++; const headers = new Headers(options.headers);
    assert(!headers.has('Cookie')); assert(!headers.has('Authorization'));
    return { body: Buffer.from('{}'), headers, status: 200 }; };
  await anonymousXJSON('https://api.fxtwitter.com/2/search?q=conversation_id%3A' + root.id, remote);
  for (const u of ['https://secret@api.fxtwitter.com/2/search', 'https://127.0.0.1/2/search', 'http://api.fxtwitter.com/2/search', 'https://api.fxtwitter.com/admin', 'https://api.fxtwitter.com:444/2/search']) await assert.rejects(() => anonymousXJSON(u, remote));
  assert.equal(calls, 1);
});
