import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { xHandle, xAccounts, normalizeXPost, anonymousPinnedID, collectXAccount, xCandidates, xMaterial, selfThread, mergeXPost } from '../x-source.mjs';
const clock = Date.parse('2026-10-05T04:00:00Z'), DAY = 86400000;
const pid = (ms, n = 0) => ((BigInt(ms - 1288834974657) << 22n) + BigInt(n)).toString();
const raw = (days = 0, n = 0, fields = {}) => {
  const ms = clock - days * DAY - n * 1000;
  return { id: pid(ms, n), text: '用于测试的公开 AI 材料', author: { screen_name: 'Alice', name: '测试作者', avatar_url: 'https://pbs.twimg.com/profile_images/test.jpg' }, created_timestamp: Math.floor(ms / 1000), likes: 5, bookmarks: null, ...fields };
};
const norm = r => normalizeXPost(r, 'Alice', new Date(clock).toISOString());

test('accept public handles, reject credentials, non-profile URLs and duplicate identities', () => {
  assert.equal(xHandle(' @AI_Jasonyu '), 'AI_Jasonyu');
  assert.equal(xHandle('https://x.com/dotey/'), 'dotey');
  for (const value of ['鱼总聊AI', 'https://evil.test/Alice', 'https://secret@x.com/Alice', 'https://x.com/Alice/status/20', '@a/b', 'https://x.com/i', '']) assert.throws(() => xHandle(value));
  assert.throws(() => xAccounts([{ handle: 'Alice' }, { handle: 'ALICE' }]), /重复/);
  assert.equal(xAccounts([{ handle: 'Alice', enabled: false }])[0].enabled, false);
  const expanded = Array.from({ length: 20 }, (_, n) => ({ handle: 'Observer' + n }));
  assert.equal(xAccounts(expanded).length, 20);
  assert.throws(() => xAccounts([...expanded, { handle: 'OneMore' }]), /最多观察 20/);
});

test('preserve Article-only posts, quoted attribution, unknown metrics and stable content fingerprints', () => {
  const q = raw(1, 2, { author: { screen_name: 'Bob', name: '被引用作者' }, article: { id: pid(clock, 3), title: '被引用长文', preview_text: '预览', content: { blocks: [{ text: '正文甲' }, { text: '正文乙' }] } } });
  const p = norm(raw(0, 1, { text: '这太强了', quote: q }));
  const material = xMaterial(p);
  assert(material.summary.includes('不是观察账号本人创作'));
  assert(material.summary.includes('正文甲\n\n正文乙'));
  assert.equal(p.title, '被引用长文'); assert.equal(p.metrics.views, null);
  assert.equal(norm(raw(0, 1, { text: '这太强了', quote: q, likes: 999 })).fingerprint, p.fingerprint);
  const articleOnly = norm(raw(0, 4, { text: '', article: { id: pid(clock, 5), title: '有正文的长文', content: { blocks: [{ text: '完整文章' }] } } }));
  assert.equal(articleOnly.kind, 'article'); assert(xMaterial(articleOnly).summary.includes('完整文章'));
  assert.equal(norm(raw(0, 6, { quote: { type: 'tombstone' } })).quoteUnavailable, true);
  assert.equal(norm(raw(0, 7, { created_timestamp: clock / 1000 - DAY / 1000 })), null);
  assert.equal(norm(raw(0, 8, { author: { screen_name: 'Alice', protected: true } })), null);
  assert.equal(norm(raw(0, 9, { media: { photos: [{ url: 'https://127.0.0.1/private.jpg' }] } })).thumbnail, '');
  const photoOnly = norm(raw(0, 10, { text: '', media: { photos: [{ url: 'https://pbs.twimg.com/media/photo.png' }] } }));
  assert(photoOnly); assert.equal(photoOnly.body, ''); assert.equal(photoOnly.thumbnail, 'https://pbs.twimg.com/media/photo.png');
  assert(norm(raw(0, 11, { text: '', quote: q })), 'A quote without commentary remains a public post');
  assert.equal(norm(raw(0, 12, { text: '', media: { photos: [{ url: 'https://evil.test/image.png' }] } })), null);
});

test('anonymous pin parser requires explicit Pin marker and handles the real public profile fixture without execution', () => {
  assert.equal(anonymousPinnedID('__typename:"TimelinePinEntry",context_type:"Pin",rest_id:"2104911243739853231"'), '2104911243739853231');
  assert.equal(anonymousPinnedID('__typename:"TimelinePinEntry",rest_id:"2104911243739853231"'), null);
  assert.equal(anonymousPinnedID('rest_id:"2104911243739853231"'), null);
  const file = new URL('../../research/fish-ai-check-20261004T190245Z/x-profile.html', import.meta.url);
  if (fs.existsSync(file)) assert.equal(anonymousPinnedID(fs.readFileSync(file, 'utf8')), '2104911243739853231');
});
test('lightweight timeline refresh preserves separately read article bodies with their original capture time', () => {
  const a = { id: pid(clock, 1), title: '长文', preview_text: '同一预览', content: { blocks: [{ text: '完整正文' }] } };
  const full = norm(raw(1, 2, { article: a })); const small = norm(raw(1, 2, { article: { ...a, content: { blocks: [] } }, bookmarks: 100 }));
  const merged = mergeXPost(full, small);
  assert.equal(merged.article.body, '完整正文'); assert.equal(merged.article.bodyFetchedAt, full.fetchedAt); assert.equal(merged.metrics.bookmarks, 100);
  assert.equal(merged.fingerprint, full.fingerprint);
  const edited = norm(raw(1, 2, { article: { ...a, preview_text: '文章已经修改', content: { blocks: [] } } }));
  assert.equal(mergeXPost(full, edited).article.body, '', 'Changed previews must not inherit the old body as fresh content');
});

test('pagination deduplicates IDs, excludes reposts, distinguishes old pin and reports the actual requested window', async () => {
  const p = raw(1, 1), reply = raw(1, 2, { replying_to: { status: p.id, screen_name: 'Alice' } });
  const pin = raw(40, 10, { article: { id: pid(clock - 40 * DAY, 11), title: '旧置顶', content: { blocks: [{ text: '旧正文' }] } } });
  let calls = 0;
  const snapshot = await collectXAccount({ handle: 'Alice' }, { clock, fetchProfile: async () => `__typename:"TimelinePinEntry",context_type:"Pin",rest_id:"${pin.id}"`, fetchJSON: async url => {
    calls++;
    if (url.includes('/status/')) return { code: 200, tweet: pin };
    if (new URL(url).searchParams.has('cursor')) return { code: 200, results: [p, raw(13, 5)], cursor: { bottom: null } };
    return { data: { code: 200, results: [p, reply, raw(2, 3, { reposted_by: { screen_name: 'Alice' }, author: { screen_name: 'Bob' } })], cursor: { bottom: 'page2' } }, cacheAge: '12' };
  } });
  assert.equal(calls, 3); assert.equal(snapshot.posts.length, 2); assert.equal(snapshot.report.pages, 2);
  assert.equal(snapshot.report.status, 'ok'); assert.equal(snapshot.report.receivedRoots, 1);
  assert.equal(snapshot.report.requestedStart, new Date(clock - 12 * DAY).toISOString());
  assert.equal(snapshot.report.pageRequests[0].cacheAge, '12');
  assert.equal(snapshot.pinned.title, '旧置顶'); assert.equal(snapshot.report.pin.status, 'confirmed');
  assert.equal(xCandidates([{ handle: 'Alice', enabled: true }], [snapshot], '', clock).length, 1);
});

test('out-of-window exclusions do not mark recent history partial; relevant and undated exclusions remain visible', async () => {
  const common = { clock, fetchProfile: async () => '' };
  const run = rows => collectXAccount({ handle: 'Alice' }, { ...common, fetchJSON: async () => ({ code: 200, results: rows, cursor: {} }) });
  const root = raw(1, 1), oldEmpty = raw(40, 2, { text: '' });
  const oldOnly = await run([root, oldEmpty]);
  assert.equal(oldOnly.report.status, 'ok'); assert.equal(oldOnly.report.skippedInvalid, 0);
  assert.equal(oldOnly.report.skippedOutsideWindow, 1); assert.equal(oldOnly.report.excludedRecords[0].id, oldEmpty.id);
  assert.equal(oldOnly.report.excludedRecords[0].affectsWindow, false);
  const recentEmpty = raw(1, 3, { text: '' });
  const recent = await run([root, oldEmpty, recentEmpty]);
  assert.equal(recent.report.status, 'partial'); assert.equal(recent.report.skippedInvalid, 1);
  assert.equal(recent.report.excludedRecords.find(r => r.id === recentEmpty.id).affectsWindow, true);
  assert.match(recent.report.excludedRecords.find(r => r.id === recentEmpty.id).reason, /没有可读取/);
  const conflicting = raw(40, 4, { created_timestamp: clock / 1000 });
  const unknownDate = await run([root, conflicting]);
  assert.equal(unknownDate.report.status, 'partial'); assert.equal(unknownDate.report.excludedRecords[0].publishedAt, null);
  assert.match(unknownDate.report.excludedRecords[0].reason, /不一致/);
  const photoReply = raw(40, 5, { text: '', media: { photos: [{ url: 'https://pbs.twimg.com/media/old.png' }] }, replying_to: { screen_name: 'Alice', status: root.id } });
  const validOldPhoto = await run([root, photoReply]);
  assert.equal(validOldPhoto.report.status, 'ok'); assert.equal(validOldPhoto.report.skippedInvalid, 0);
  assert.equal(validOldPhoto.posts.length, 1, 'Old image replies must not be added to the requested window');
});

test('partial failures and rate limits retain the last successful snapshot without reporting it as fresh', async () => {
  const post = norm(raw(2, 1)); const previous = { posts: [post], pinned: post, report: { lastSuccessAt: '2026-10-01T00:00:00Z' } };
  let attemptedPin = false;
  const snapshot = await collectXAccount({ handle: 'Alice' }, { clock, previous, fetchProfile: async () => { attemptedPin = true; }, fetchJSON: async () => { const e = new Error('429 测试限流'); e.rateLimited = true; e.retryAt = '2026-10-05T05:00:00Z'; throw e; } });
  assert.equal(snapshot.report.status, 'error'); assert.equal(snapshot.report.lastSuccessAt, previous.report.lastSuccessAt);
  assert.equal(snapshot.report.received, 0); assert.equal(snapshot.posts[0].id, post.id); assert.equal(snapshot.pinned.id, post.id);
  assert.equal(attemptedPin, false); assert.equal(snapshot.report.retryAt, '2026-10-05T05:00:00Z');
  let pages = 0;
  const partial = await collectXAccount({ handle: 'Alice' }, { clock, fetchProfile: async () => { throw Error('匿名主页不可读'); }, fetchJSON: async () => { if (pages++) throw Error('503 测试失败'); return { code: 200, results: [raw(0, 2)], cursor: { bottom: 'more' } }; } });
  assert.equal(partial.report.status, 'partial'); assert.equal(partial.report.receivedRoots, 1); assert.match(partial.report.error, /503/);
  assert.equal(partial.report.pin.status, 'unavailable'); assert.equal(partial.pinned, null);
});

test('stop repeated cursors and page caps; reaching an old page boundary does not claim completeness', async () => {
  const common = { clock, fetchProfile: async () => '' };
  const loop = await collectXAccount({ handle: 'Alice' }, { ...common, fetchJSON: async () => ({ code: 200, results: [raw(0, 1)], cursor: { bottom: 'same' } }) });
  assert.equal(loop.report.pages, 2); assert.equal(loop.report.status, 'partial'); assert.match(loop.report.error, /游标/);
  const cap = await collectXAccount({ handle: 'Alice' }, { ...common, maxPages: 1, fetchJSON: async () => ({ code: 200, results: [raw(0, 1)], cursor: { bottom: 'next' } }) });
  assert.equal(cap.report.capReached, true); assert.equal(cap.report.status, 'partial');
  let calls = 0;
  const boundary = await collectXAccount({ handle: 'Alice' }, { ...common, fetchJSON: async () => ({ code: 200, results: [raw(20, calls)], cursor: { bottom: String(++calls) } }) });
  assert.equal(boundary.report.pages, 2); assert.equal(boundary.report.reachedBoundary, true); assert.match(boundary.report.notice, /不能证明/);
});

test('only related self-replies enter a root material; seven-day candidates exclude old, inactive and reply-only posts', () => {
  const root = norm(raw(1, 1)), child = norm(raw(1, 2, { replying_to: { status: root.id, screen_name: 'Alice' } }));
  const grandchild = norm(raw(1, 3, { replying_to: { status: child.id, screen_name: 'Alice' } }));
  const disconnected = norm(raw(1, 4, { replying_to: { status: '123456789', screen_name: 'Other' } }));
  const old = norm(raw(9, 5)); const posts = [root, child, grandchild, disconnected, old];
  assert.equal(selfThread(root, posts).length, 2);
  assert.equal(xCandidates([{ handle: 'Alice', enabled: true }], [{ handle: 'Alice', posts }], '', clock).length, 1);
  assert.equal(xCandidates([{ handle: 'Alice', enabled: false }], [{ handle: 'Alice', posts }], '', clock).length, 0);
  assert.equal(xCandidates([{ handle: 'Alice', enabled: true }], [{ handle: 'Alice', posts }], '不存在主题', clock).length, 0);
});

test('bounded candidates retain both recent and highly bookmarked posts and distribute accounts fairly', () => {
  const accounts = Array.from({ length: 20 }, (_, i) => ({ handle: 'Actor' + i, enabled: true }));
  const snapshots = accounts.map((a, index) => ({ handle: a.handle, posts: Array.from({ length: 25 }, (_, n) => { const r = raw(n / 10, n, { author: { screen_name: a.handle }, bookmarks: n === 24 ? 100000 : n }); r.id = (BigInt(r.id) + BigInt(index * 10000)).toString(); return normalizeXPost(r, a.handle); }) }));
  const result = xCandidates(accounts, snapshots, '', clock);
  assert.equal(result.length, 48); assert.equal(new Set(result.map(p => p.source)).size, 20);
  for (const s of snapshots) assert(result.some(i => i.id === 'x-' + s.posts[24].id));
  const single = xCandidates(accounts.slice(0, 1), snapshots, '', clock);
  assert.equal(single.length, 12); assert(single.some(i => i.id === 'x-' + snapshots[0].posts[24].id));
});
