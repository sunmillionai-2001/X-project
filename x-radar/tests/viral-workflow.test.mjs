import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), data = fs.mkdtempSync(path.join(os.tmpdir(), 'viral-acceptance-'));
const base = 'http://127.0.0.1:18774'; let child;
const pause = ms => new Promise(r => setTimeout(r, ms));
async function start() {
  child = spawn(process.execPath, ['--import', pathToFileURL(path.join(here, 'mock-network.mjs')).href, path.join(here, '../server.mjs')], { env: { ...process.env, XRADAR_DATA: data, XRADAR_PORT: '18774', XRADAR_PUBLIC_PROXY: 'off' }, stdio: 'pipe', windowsHide: true });
  let log = ''; child.stderr.on('data', c => { log += c; });
  for (let n = 0; n < 50; n++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await pause(100); }
  throw Error(log);
}
async function stop() { if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once('exit', r)); } }
async function request(route, value) { const r = await fetch(base + route, value === undefined ? {} : { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(value) }); const out = await r.json(); if (!r.ok) throw Error(out.error); return out; }
async function job(route, value = {}) { let out = await request(route, value); for (let n = 0; n < 200 && out.status === 'running'; n++) { await pause(30); out = await request('/api/job/' + out.id); } if (out.status === 'error') throw Error(out.error); assert.equal(out.status, 'done'); return out.result; }
test('creator research → original draft → persistence → human approval → manual image workflow', { timeout: 60000 }, async t => {
  await start(); t.after(stop);
  await request('/api/x/accounts', { revision: 0, accounts: [{ handle: 'StudyAI', name: '合成知识博主' }] });
  await job('/api/x/refresh');
  await request('/api/settings', { textBase: 'https://example.com/v1', textModel: 'fixture', textKey: 'isolated-test-only' });
  const study = await job('/api/viral/research', { handles: ['StudyAI'] });
  assert.equal(study.profiles.length, 1); assert(study.methods.sources.includes('dbs-spread'));
  let d = await job('/api/viral/create', { studyId: study.id, topic: '合成测试主题', ownAngle: '仅用于验收，不是用户真实的发布内容', ownMaterial: '合成测试记录，不能作为真实经历。'.repeat(12), sources: [] });
  assert.equal(d.images.length, 2);
  await assert.rejects(() => request('/api/viral/save', { id: d.id, revision: 0, body: d.body }), /其他窗口/);
  await assert.rejects(() => request('/api/viral/save', { id: d.id, revision: d.revision, body: d.body, annotations: { sourceNotes: [{ materialId: 'fake', quote: '不存在的原句', use: '虚构' }] } }), /不存在/);
  const imageBinding = d.imagesBodyHash;
  d = await request('/api/viral/save', { id: d.id, revision: d.revision, body: d.body, annotations: { verificationNotes: ['编辑校正：隔离测试材料，尚未核实'] } });
  assert.equal(d.annotationsEdited, true); assert.equal(d.imagesBodyHash, imageBinding); assert.equal(d.versions.length, 1);
  let p = await request('/api/viral/promote', { id: d.id, revision: d.revision });
  assert.equal(p.outlineApproved, false); assert.equal(p.draft, d.body); assert.equal(p.stage, 'outline');
  const latest = (await request('/api/state')).viral.drafts[0];
  const again = await request('/api/viral/promote', { id: d.id, revision: latest.revision }); assert.equal(again.id, p.id);
  await assert.rejects(() => job('/api/plan', { id: p.id, revision: p.revision }), /确认正文/);
  p = await request('/api/outline', { id: p.id, revision: p.revision, angle: p.angle, outline: p.outline }); assert.equal(p.draft, d.body);
  p = await request('/api/draft/approve', { id: p.id, revision: p.revision });
  const before = (await request('/api/state')).calls.length;
  p = await job('/api/plan', { id: p.id, revision: p.revision }); assert.equal(p.plan.length, 2);
  assert.equal((await request('/api/state')).calls.length, before, 'Unchanged imported body reuses its existing image prompts');
  assert.equal(p.planApproved, false);
  p = await request('/api/plan/approve', { id: p.id, revision: p.revision }); assert.equal(p.stage, 'images');
  const image = p.plan[0];
  p = await request('/api/upload', { id: p.id, revision: p.revision, planId: image.id, label: '隔离测试图片', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNAAAAABJRU5ErkJggg==' });
  assert.equal(p.assets[0].origin, 'import');
  await stop(); await start();
  const state = await request('/api/state'); assert.equal(state.viral.studies[0].id, study.id); assert.equal(state.viral.drafts[0].body, d.body); assert.equal(state.projects.length, 1); assert.equal(state.settings.imageMode, 'manual');
  assert((await fetch(base + '/viral-view.js')).ok);
});
