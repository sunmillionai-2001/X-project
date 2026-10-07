import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), data = fs.mkdtempSync(path.join(os.tmpdir(), 'x-source-acceptance-'));
const base = 'http://127.0.0.1:18772'; let child;
const pause = ms => new Promise(r => setTimeout(r, ms));
async function start() {
  child = spawn(process.execPath, ['--import', pathToFileURL(path.join(here, 'mock-network.mjs')).href, path.join(here, '../server.mjs')], { env: { ...process.env, XRADAR_DATA: data, XRADAR_PORT: '18772', XRADAR_PUBLIC_PROXY: 'off' }, stdio: 'pipe', windowsHide: true });
  let log = ''; child.stderr.on('data', c => { log += c; });
  for (let n = 0; n < 50; n++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await pause(150); }
  throw Error('X test server did not start: ' + log);
}
async function stop() { if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once('exit', r)); } }
async function request(route, value) { const r = await fetch(base + route, value === undefined ? {} : { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(value) }); const out = await r.json(); if (!r.ok) throw Error(out.error); return out; }
async function job(route, value = {}) { let out = await request(route, value); for (let n = 0; n < 200 && out.status === 'running'; n++) { await pause(30); out = await request('/api/job/' + out.id); } if (out.status === 'error') throw Error(out.error); assert.equal(out.status, 'done'); return out.result; }
test('X source refresh, quotes, old pin, full-text workflow, disabling, persistence and rate-limit truthfulness', { timeout: 60000 }, async t => {
  await start(); t.after(stop);
  let state = await request('/api/state'); assert.equal(state.x.config.accounts.length, 4);
  assert.equal(state.x.requiresLogin, false); assert.equal(state.x.officialAPI, false);
  assert.equal(state.x.accountLimit, 20);
  const expanded = await request('/api/x/accounts', { revision: 0, accounts: Array.from({ length: 14 }, (_, n) => ({ handle: 'Observer' + n, enabled: false })) });
  await assert.rejects(() => request('/api/x/accounts', { revision: expanded.revision, accounts: Array.from({ length: 21 }, (_, n) => ({ handle: 'Observer' + n })) }), /最多观察 20/);
  await stop(); await start();
  state = await request('/api/state'); assert.equal(state.x.config.accounts.length, 14); assert.equal(state.x.config.revision, expanded.revision);
  let config = await request('/api/x/accounts', { revision: expanded.revision, accounts: [{ handle: 'Alice', name: '合成测试观察账号', enabled: true }] });
  await assert.rejects(() => request('/api/x/accounts', { revision: 0, accounts: [] }), /其他窗口/);
  await assert.rejects(() => request('/api/x/accounts', { revision: config.revision, accounts: [{ handle: 'Alice' }, { handle: 'ALICE' }] }), /重复/);
  const refreshed = await job('/api/x/refresh');
  const a = refreshed.accounts[0]; assert.equal(a.report.pages, 2); assert.equal(a.report.status, 'ok');
  assert.equal(a.posts.filter(p => !p.replyToId).length, 2); assert.equal(a.pinned.article.title, '合成旧置顶 · Alice');
  assert.equal((await request('/api/state')).calls.length, 0, 'Public-source refresh must not invoke paid models');
  const pool = await job('/api/collect'); assert.equal(pool.items.filter(i => i.sourceKind === 'x').length, 2);
  const image = await fetch(base + '/api/x/image?url=' + encodeURIComponent('https://pbs.twimg.com/media/test.png'));
  assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png'); assert.equal(image.headers.get('cache-control'), 'private, max-age=21600');
  for (const url of ['https://127.0.0.1/image.png', 'https://secret@pbs.twimg.com/media/private.png', 'http://pbs.twimg.com/media/test.png', 'https://example.com/image.png']) assert.equal((await fetch(base + '/api/x/image?url=' + encodeURIComponent(url))).status, 400);
  assert(!pool.items.some(i => i.url === a.pinned.url));
  const quoted = pool.items.find(i => i.summary.includes('被引用的 AI 玩法')); assert(quoted.summary.includes('不是观察账号本人创作'));
  const root = a.posts.find(p => p.article);
  await assert.rejects(() => job('/api/x/topic', { handle: 'Alice', postId: root.id }), /配置/);
  await request('/api/settings', { textBase: 'https://example.com/v1', textModel: 'fixture', textKey: 'private-x-test-only' });
  const result = await job('/api/x/topic', { handle: 'Alice', postId: root.id });
  assert.equal(result.cards.length, 1); assert.equal(result.cards[0].sources[0].sourceKind, 'x');
  const thread = await job('/api/x/thread', { handle: 'Alice', postId: root.id });
  assert.equal(thread.posts.filter(p => p.replyToId).length, 2);
  assert(thread.posts.find(p => p.id === root.id).threadFetchedAt);
  let p = await request('/api/project', { cardId: result.cards[0].id });
  p = await job('/api/source', { id: p.id, revision: p.revision, url: root.url });
  assert(p.evidence[0].material.includes('合成全文段落甲')); assert(p.evidence[0].notice.includes('公开帖子'));
  const originalDaily = await job('/api/recommend'); const originalID = originalDaily.id;
  const newDaily = await job('/api/recommend', { refresh: true }); assert.equal(newDaily.id, originalID); assert(newDaily.revision > originalDaily.revision);
  config = await request('/api/x/accounts', { revision: config.revision, accounts: [{ handle: 'Alice', enabled: false }] });
  const withoutX = await job('/api/collect'); assert.equal(withoutX.items.filter(i => i.sourceKind === 'x').length, 0);
  assert.equal((await request('/api/state')).x.accounts[0].posts.length, thread.posts.length);
  await stop(); await start();
  state = await request('/api/state'); assert.equal(state.x.config.accounts[0].enabled, false); assert.equal(state.x.accounts[0].posts.length, thread.posts.length);
  assert(!JSON.stringify(state).includes('private-x-test-only'));
  config = await request('/api/x/accounts', { revision: config.revision, accounts: [{ handle: 'Alice', enabled: true }, { handle: 'FailAI', enabled: true }] });
  const failed = await job('/api/x/refresh'); assert.equal(failed.accounts.find(s => s.handle === 'FailAI').report.status, 'error');
  config = await request('/api/x/accounts', { revision: config.revision, accounts: [{ handle: 'Alice', enabled: true }, { handle: 'RateAI', enabled: true }] });
  const limited = await job('/api/x/refresh', { handle: 'RateAI' }); assert.equal(limited.accounts.find(s => s.handle === 'RateAI').report.status, 'error'); assert(limited.retryAt);
  const lastGood = (await request('/api/state')).x.accounts.find(s => s.handle === 'Alice');
  const cached = await job('/api/x/refresh', { handle: 'Alice' }); const old = cached.accounts.find(s => s.handle === 'Alice');
  assert.equal(old.report.status, 'error'); assert.equal(old.report.received, 0); assert.equal(old.report.lastSuccessAt, lastGood.report.lastSuccessAt); assert.equal(old.posts.length, lastGood.posts.length);
  const csrf = await fetch(base + '/api/x/refresh', { method: 'POST', headers: { Origin: 'https://other.test', 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(csrf.status, 400);
});
