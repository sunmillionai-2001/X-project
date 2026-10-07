import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath,pathToFileURL } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),data=fs.mkdtempSync(path.join(os.tmpdir(),'draft-pictures-')),base='http://127.0.0.1:18778';let child;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){child=spawn(process.execPath,['--import',pathToFileURL(path.join(here,'mock-network.mjs')).href,path.join(here,'../server.mjs')],{env:{...process.env,XRADAR_DATA:data,XRADAR_PORT:'18778',XRADAR_PUBLIC_PROXY:'off'},stdio:'pipe',windowsHide:true});let log='';child.stderr.on('data',c=>{log+=c});for(let n=0;n<50;n++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await pause(100);}throw Error(log);}
async function stop(){if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}}
async function request(route,value){const r=await fetch(base+route,value===undefined?{}:{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(value)});const out=await r.json();if(!r.ok)throw Error(out.error);return out;}
async function finish(j){for(let n=0;n<200&&j.status==='running';n++){await pause(30);j=await request('/api/job/'+j.id);}if(j.status==='error')throw Error(j.error);assert.equal(j.status,'done');return j.result;}
async function job(route,value={}){return finish(await request(route,value));}
test('inline draft API pictures persist partial success, skip paid repeats, import manually and transfer with approvals intact',{timeout:60000},async t=>{
  await start();t.after(stop);
  await request('/api/x/accounts',{revision:0,accounts:[{handle:'StudyAI',name:'合成测试博主'}]});await job('/api/x/refresh');
  await request('/api/settings',{textBase:'https://example.com/v1',textModel:'fixture',textKey:'isolated-test-only',imageMode:'api',imageBase:'https://example.com/v1',imageModel:'partial-image',imageKey:'isolated-test-image'});
  const study=await job('/api/viral/research',{handles:['StudyAI']});
  let d=await job('/api/viral/create',{studyId:study.id,topic:'隔离图文验收',ownAngle:'只验证软件流程，不代表用户真实经历',ownMaterial:'合成测试材料，不作为真实发布内容。'.repeat(15),sources:[]});
  await assert.rejects(()=>job('/api/viral/images',{id:d.id,revision:d.revision}),/403/);
  d=(await request('/api/state')).viral.drafts[0];assert.equal(d.imageAssets.length,1);assert.equal(d.imageAssets[0].current,true);
  const before=(await request('/api/state')).calls.length;
  await request('/api/settings',{imageModel:'slow-image'});
  const running=await request('/api/viral/images',{id:d.id,revision:d.revision});
  await assert.rejects(()=>request('/api/viral/save',{id:d.id,revision:d.revision,body:d.body+'修改'}),/正在生成图片/);
  d=await finish(running);assert.equal(d.imageAssets.length,2);assert.equal((await request('/api/state')).calls.length,before+1,'retry only generates the missing picture');
  await job('/api/viral/images',{id:d.id,revision:d.revision});assert.equal((await request('/api/state')).calls.length,before+1,'completed pictures are not billed again');
  assert((await fetch(base+'/assets/'+d.imageAssets[0].file)).ok);
  d=await request('/api/viral/images/upload',{id:d.id,revision:d.revision,index:0,data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNAAAAABJRU5ErkJggg=='});
  assert.equal(d.imageAssets[0].origin,'import');
  let p=await request('/api/viral/promote',{id:d.id,revision:d.revision});assert.equal(p.suggestedImageAssets.length,2);assert.equal(p.outlineApproved,false);assert.equal(p.draftApproved,false);assert.equal(p.planApproved,false);
  p=await request('/api/outline',{id:p.id,revision:p.revision,angle:p.angle,outline:p.outline});p=await request('/api/draft/approve',{id:p.id,revision:p.revision});
  p=await job('/api/plan',{id:p.id,revision:p.revision});assert.equal(p.assets.length,2);assert.equal(p.planApproved,false);assert(p.assets.some(a=>a.origin==='import'));
  p=await request('/api/plan/approve',{id:p.id,revision:p.revision});assert.equal(p.stage,'images');
  d=(await request('/api/state')).viral.drafts[0];d=await request('/api/viral/save',{id:d.id,revision:d.revision,body:d.body+'\n新结尾'});
  await assert.rejects(()=>job('/api/viral/images',{id:d.id,revision:d.revision}),/正文已修改/);
  d=(await request('/api/state')).viral.drafts[0];assert(d.imageAssets.every(a=>!a.current));
  d=await request('/api/viral/images/save',{id:d.id,revision:d.revision,images:d.images});assert.equal(d.imagePromptsCurrent,true);
  await stop();await start();const s=await request('/api/state');assert.equal(s.viral.drafts[0].imageAssets.length,3);assert.equal(s.projects[0].assets.length,2);assert.equal(s.viral.drafts[0].imagePromptsCurrent,true);
});
