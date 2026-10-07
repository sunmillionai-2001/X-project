// Production public-source acceptance only. Never invokes writing/image models or reads secret files.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8770';
async function request(route, data) {
  const r = await fetch(base + route, data === undefined ? {} : { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await r.json(); if (!r.ok) throw Error(result.error); return result;
}
const before = await request('/api/state');
let job = await request('/api/x/refresh', {});
for (let n = 0; n < 240 && job.status === 'running'; n++) {
  if (n % 5 === 0) console.log(JSON.stringify({ status: job.status, progress: job.message || '正在采集公开帖子' }));
  await new Promise(r => setTimeout(r, 1000)); job = await request('/api/job/' + job.id);
}
assert.equal(job.status, 'done', job.error || 'Public refresh did not finish');
const after = await request('/api/state');
assert.equal(after.calls.length, before.calls.length, 'Source refresh unexpectedly invoked a model');
assert.equal(after.projects.length, before.projects.length);
assert.equal(after.daily?.id, before.daily?.id);
const fish = after.x.accounts.find(s => s.handle.toLowerCase() === 'ai_jasonyu');
assert(fish.posts.filter(p => !p.replyToId).length >= 5, 'Fewer than five fish posts received');
const report = {
  checkedAt: new Date().toISOString(), sourceOnly: true, modelCallsAdded: after.calls.length - before.calls.length,
  projectCount: after.projects.length, existingDailyPreserved: after.daily?.id === before.daily?.id,
  accounts: after.x.accounts.map(s => ({ handle: s.handle, name: s.name, mainPosts: s.posts.filter(p => !p.replyToId).length, replies: s.posts.filter(p => p.replyToId).length, report: s.report,
    pinned: s.pinned ? { id: s.pinned.id, title: s.pinned.title, articleCharacters: s.pinned.article?.body.length || 0, originalPublishedAt: s.pinned.publishedAt, verifiedAt: s.pinned.pinVerifiedAt } : null })),
  fishLatestFive: fish.posts.filter(p => !p.replyToId).slice(0, 5).map(p => ({ id: p.id, title: p.title, url: p.url, publishedAt: p.publishedAt, quote: p.quote?.author || null })),
};
fs.writeFileSync(new URL('./X信号源模块-真实采集验收.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ...report, accounts: report.accounts.map(({ report, ...s }) => ({ ...s, status: report.status, pages: report.pages, pinStatus: report.pin.status, error: report.error, pinError: report.pin.error })) }, null, 2));
