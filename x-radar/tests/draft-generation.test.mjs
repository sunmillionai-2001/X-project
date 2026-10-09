import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'x-radar-draft-'));
const port = 18905, base = `http://127.0.0.1:${port}`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let child;
async function start() {
  let log = '';
  child = spawn(process.execPath, ['--import', pathToFileURL(path.join(here, 'mock-network.mjs')).href, path.join(here, '../server.mjs')], {
    env: { ...process.env, XRADAR_DATA: data, XRADAR_PORT: String(port), XRADAR_PUBLIC_PROXY: 'off' }, windowsHide: true, stdio: 'pipe'
  });
  child.stderr.on('data', c => { log += c.toString(); });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await pause(150); }
  throw Error('Test server failed: ' + log);
}
async function stop() {
  if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
}
async function request(route, input) {
  const r = await fetch(base + route, input === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(input) });
  const output = await r.json(); if (!r.ok) throw Error(output.error); return output;
}
async function job(route, input) {
  let j = await request(route, input);
  for (let i = 0; i < 300 && j.status === 'running'; i++) { await pause(30); j = await request('/api/job/' + j.id); }
  if (j.status === 'error') throw Error(j.error);
  assert.equal(j.status, 'done'); return j.result;
}
const callCount = async () => (await request('/api/state')).calls.length;

test('generated drafts survive suggested-length failures, explicit adjustment and restart without automatic paid retries', { timeout: 30000 }, async t => {
  await start(); t.after(stop);
  await request('/api/settings', { textBase: 'https://example.com/v1', textModel: 'fixture-short-draft', textKey: 'isolated-draft-test-key' });
  const daily = await job('/api/recommend', {});
  let p = await request('/api/project', { cardId: daily.cards[0].id });
  const pd = extra => ({ id: p.id, revision: p.revision, ...extra });

  await t.test('adjustment still requires a confirmed outline, test evidence and nonempty draft', async () => {
    const before = await callCount();
    await assert.rejects(() => job('/api/draft/adjust', pd()), /提纲/);
    p = await request('/api/outline', pd({ angle: p.angle, outline: p.outline }));
    await assert.rejects(() => job('/api/draft/adjust', pd()), /实测/);
    p = await request('/api/test', pd({ notes: '这是隔离验收中的合成测试记录，不是用户真实亲测，不用于发布。' }));
    await assert.rejects(() => job('/api/draft/adjust', pd()), /生成或保存正文/);
    assert.equal(await callCount(), before);
  });

  await t.test('short output is saved with its count, warning and version; adjustment invalidates approvals', async () => {
    const before = await callCount();
    p = await job('/api/draft', pd());
    const original = p.draft;
    assert(original.length > 0 && original.length < 800);
    assert.equal(p.draftGeneration.status, 'short');
    assert.equal(p.draftGeneration.count, [...original].length);
    assert.equal(p.versions.length, 1); assert.equal(p.versions[0].body, original);
    assert.deepEqual(p.warnings, ['测试内容，非实测产出']);
    assert.equal(await callCount(), before + 1, 'Generating a short draft makes exactly one model call');
    p = await request('/api/draft/approve', pd());
    p = await request('/api/plan/save', pd({ images: [{ kind: 'infographic', title: '合成要点', description: '隔离测试', points: ['合成材料'] }] }));
    p = await request('/api/plan/approve', pd());
    assert.equal(p.draftApproved, true); assert.equal(p.planApproved, true);
    p = await job('/api/draft/adjust', pd());
    assert.equal(p.draftGeneration.kind, 'length-adjust'); assert.equal(p.draftGeneration.status, 'within');
    assert.equal(p.versions.length, 2); assert.equal(p.versions[0].body, original);
    assert.equal(p.versions[1].body, p.draft);
    assert.equal(p.draftApproved, false); assert.equal(p.planApproved, false); assert.equal(p.plan, null);
    assert.equal(p.testApproved, true); assert.equal(p.stage, 'draft');
    assert.equal(await callCount(), before + 2);
    await assert.rejects(() => job('/api/draft/adjust', pd()), /已在建议字数范围/);
    assert.equal(await callCount(), before + 2, 'An unnecessary adjustment must not incur a model call');
  });

  await t.test('long output is retained and survives restart, then explicit condensation adds one version', async () => {
    await request('/api/settings', { textModel: 'fixture-long-draft' });
    const before = await callCount();
    p = await job('/api/draft', pd());
    const long = p.draft, versions = p.versions.length;
    assert([...long].length > 1500); assert.equal(p.draftGeneration.status, 'long');
    assert.equal(p.draftGeneration.count, [...long].length); assert.equal(await callCount(), before + 1);
    await stop(); await start();
    p = (await request('/api/state')).projects.find(item => item.id === p.id);
    assert.equal(p.draft, long); assert.equal(p.versions.length, versions);
    p = await job('/api/draft/adjust', pd());
    assert.equal(p.draftGeneration.status, 'within'); assert.equal(p.versions.length, versions + 1);
    assert.equal(p.versions.at(-2).body, long); assert.equal(await callCount(), before + 2);
  });

  await t.test('empty provider output preserves the saved draft, revision, warnings and history', async () => {
    await request('/api/settings', { textModel: 'fixture-empty-draft' });
    const before = await callCount(), saved = structuredClone(p);
    await assert.rejects(() => job('/api/draft', pd()), /空正文.*保留已有内容/);
    p = (await request('/api/state')).projects.find(item => item.id === p.id);
    assert.deepEqual(p, saved); assert.equal(await callCount(), before + 1);
  });

  await t.test('an adjustment that remains short saves its output and never loops', async () => {
    await request('/api/settings', { textModel: 'fixture-short-draft' });
    p = await job('/api/draft', pd());
    const original = p.draft, before = await callCount();
    await request('/api/settings', { textModel: 'fixture-short-adjust' });
    p = await job('/api/draft/adjust', pd());
    assert.equal(p.draftGeneration.status, 'short'); assert.notEqual(p.draft, original);
    assert.equal(p.versions.at(-2).body, original); assert.equal(p.versions.at(-1).body, p.draft);
    assert.equal(await callCount(), before + 1, 'Length adjustment never silently repeats paid requests');
  });
});
