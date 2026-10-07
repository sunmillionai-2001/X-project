// Refresh the real combined source pool without running any model.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = 'http://127.0.0.1:8770';
const before = await (await fetch(base + '/api/state')).json();
let job = await (await fetch(base + '/api/collect', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}' })).json();
for (let n = 0; n < 60 && job.status === 'running'; n++) { await new Promise(r => setTimeout(r, 1000)); job = await (await fetch(base + '/api/job/' + job.id)).json(); }
assert.equal(job.status, 'done', job.error);
const after = await (await fetch(base + '/api/state')).json();
const x = after.pool.items.filter(p => p.sourceKind === 'x');
assert(x.length > 0); assert.equal(after.calls.length, before.calls.length);
const report = { checkedAt: new Date().toISOString(), modelCallsAdded: 0, combinedMaterials: after.pool.items.length, xMaterials: x.length, sourceReports: after.pool.reports, candidatesRetainPublicLinks: x.every(p => p.url.startsWith('https://x.com/')), originalDailyPreserved: before.daily?.revision === after.daily?.revision };
fs.writeFileSync(new URL('./X信号源模块-选题池验收.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
