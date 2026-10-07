// Explicit opt-in network smoke check; never part of npm test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'x-radar-live-source-'));
const base = 'http://127.0.0.1:18772';
const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], { env: { ...process.env, XRADAR_PORT: '18772', XRADAR_DATA: data }, stdio: 'pipe', windowsHide: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
async function post(route, data) { const r = await fetch(base + route, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const d = await r.json(); if (!r.ok) throw Error(d.error); return d; }
try {
  let ready = false;
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {} await pause(200); }
  if (!ready) throw Error('隔离服务未启动');
  await post('/api/settings', { sources: [{ name: 'Anthropic 官方 SDK Releases', kind: 'json', url: 'https://api.github.com/repos/anthropics/anthropic-sdk-python/releases?per_page=5', enabled: true }] });
  let j = await post('/api/collect', {});
  while (j.status === 'running') { await pause(1000); j = await fetch(base + '/api/job/' + j.id).then(r => r.json()); }
  if (j.status !== 'done') throw Error(j.error);
  console.log(JSON.stringify({ ok: true, count: j.result.items.length, reports: j.result.reports }, null, 2));
  if (j.result.reports.some(r => !r.ok)) process.exitCode = 1;
} finally { if (child.exitCode === null) { child.kill(); await new Promise(r => child.once('exit', r)); } }
