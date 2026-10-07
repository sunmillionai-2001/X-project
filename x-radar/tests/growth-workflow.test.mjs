import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { researchFixture } from './growth-fixture.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),data=fs.mkdtempSync(path.join(os.tmpdir(),'growth-acceptance-')),base='http://127.0.0.1:18776';
const fixture = researchFixture(), researchFile = path.join(data, 'research.json');
fs.writeFileSync(researchFile, JSON.stringify(fixture), 'utf8');
let child;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start() {
  child=spawn(process.execPath,['--import',pathToFileURL(path.join(here,'mock-network.mjs')).href,path.join(here,'../server.mjs')],{env:{...process.env,XRADAR_DATA:data,XRADAR_RESEARCH:researchFile,XRADAR_PORT:'18776',XRADAR_PUBLIC_PROXY:'off'},stdio:'pipe',windowsHide:true});
  let log=''; child.stderr.on('data',c=>{log+=c});
  for(let n=0;n<50;n++){try{if((await fetch(base+'/api/health')).ok)return;}catch{} await pause(100);} throw Error(log);
}
async function stop(){if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}}
async function request(route,value){const r=await fetch(base+route,value===undefined?{}:{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(value)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
async function job(route,value={}){let j=await request(route,value);for(let n=0;n<200&&j.status==='running';n++){await pause(30);j=await request('/api/job/'+j.id);}if(j.status==='error')throw Error(j.error);assert.equal(j.status,'done');return j.result;}
test('growth research, separate facts, draft editing, promotion, metrics and restart persistence',{timeout:60000},async t=>{
  await start();t.after(stop);
  await request('/api/settings',{textBase:'https://example.com/v1',textModel:'fixture',textKey:'isolated-test-only'});
  const initial = await request('/api/state');
  assert.equal(initial.growth.library.lowFollowerStudies.length, 2);
  assert(!Object.hasOwn(initial.growth.library.lowFollowerStudies[0], 'referenceText'));
  assert(initial.growth.references.some(r => r.id === '100101'));
  const callCount = initial.calls.length;
  const savedStudy = await request('/api/growth/use-study', { studyId: 'low-100101' });
  assert.equal(savedStudy.reference.id, '100101');
  assert.equal((await request('/api/growth/use-study', { studyId: 'low-100101' })).id, savedStudy.id);
  assert.equal((await request('/api/state')).calls.length, callCount);
  await assert.rejects(() => request('/api/growth/use-study', { studyId: 'nonexistent' }), /不存在/);
  const curatedAnalysis = await job('/api/growth/analyze', { mode: 'cached', handle: 'FixtureOne', postId: '100101' });
  assert.equal(curatedAnalysis.reference.referenceKind, 'curated-low-follower');
  assert.equal(curatedAnalysis.reference.fetchedAt, initial.growth.references.find(r => r.id === '100101').fetchedAt);
  const a=await job('/api/growth/analyze',{mode:'manual',referenceText:'合成参考原文，只用于隔离测试。'.repeat(15),referenceURL:'https://x.com/Study/status/123'});
  assert.equal(a.structure.length,3);
  await assert.rejects(()=>job('/api/growth/create',{analysisId:a.id,topic:'隔离原创图文',ownAngle:'仅用于验收，不是用户真实发布内容',ownMaterial:'短'}),/100/);
  await request('/api/settings',{textModel:'growth-missing-citation'});
  let d=await job('/api/growth/create',{analysisId:a.id,topic:'隔离原创图文',ownAngle:'仅用于验收，不是用户真实发布内容',ownMaterial:'自己的合成材料，不能作为真实个人体验。'.repeat(15)});
  assert.equal(d.images.length,2); assert.equal(d.sourceNotes[0].materialId,'own-material');
  assert((await request('/api/state')).calls.some(c=>c.purpose==='X 起号 · 草稿字段修复'));
  await assert.rejects(()=>request('/api/growth/save',{id:d.id,revision:0,body:d.body}),/其他窗口/);
  const imageHash=d.imagesBodyHash;
  d=await request('/api/growth/save',{id:d.id,revision:d.revision,body:d.body+'\n编辑后的结尾。'});
  assert.equal(d.versions.length,1);assert.equal(d.imagesBodyHash,imageHash);assert.notEqual(d.bodyHash,imageHash);
  const p=await request('/api/growth/promote',{id:d.id,revision:d.revision});
  assert.equal(p.growthDraftId,d.id);assert.equal(p.outlineApproved,false);assert.equal(p.draftApproved,false);assert.equal(p.planApproved,false);
  d=(await request('/api/state')).growth.drafts[0];assert.equal((await request('/api/growth/promote',{id:d.id,revision:d.revision})).id,p.id);
  await assert.rejects(()=>job('/api/plan',{id:p.id,revision:p.revision}),/确认正文/);
  let progress=await request('/api/growth/progress',{revision:0,kind:'task',targetId:'intro',done:true});
  await assert.rejects(()=>request('/api/growth/progress',{revision:0,kind:'task',targetId:'pin',done:true}),/其他窗口/);
  progress=await request('/api/growth/progress',{revision:progress.revision,kind:'method',targetId:'hook',done:true});
  assert(progress.tasks.includes('intro'));assert(progress.learned.includes('hook'));
  const m=await request('/api/growth/metrics',{url:'https://x.com/Study/status/123',title:'合成发布数据',publishedAt:new Date(Date.now()-3*86400000).toISOString(),views:'100',bookmarks:'5',follows:''});
  assert.equal(m.follows,null);assert.equal(m.bookmarkRate,0.05);
  await stop();await start();const s=await request('/api/state');assert.equal(s.growth.analyses[0].id,a.id);assert.equal(s.growth.drafts[0].id,d.id);assert.equal(s.growth.metrics[0].id,m.id);assert.equal(s.growth.progress.tasks[0],'intro');assert.equal(s.projects.length,1);
  assert((await fetch(base+'/growth-view.js')).ok);
});
