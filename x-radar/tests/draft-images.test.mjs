import test from 'node:test';
import assert from 'node:assert/strict';
import { hash } from '../core.mjs';
import { promptHash,currentDraftImage,preparedDraftAssets,imageSelection,attachPreparedImages } from '../draft-images.mjs';
const d={id:'draft',body:'原始正文',images:[{title:'封面',prompt:'清楚的示意图'},{title:'正文图',prompt:'流程图'}],imagesBodyHash:hash('原始正文')};
const a={id:'asset',draftId:d.id,imageIndex:0,file:'first.png',draftHash:hash(d.body),promptHash:promptHash(d.images[0])};
test('picture freshness binds both body and exact saved image plan; legacy drafts and duplicated indices are checked',()=>{
  assert(currentDraftImage(d,a));assert(!currentDraftImage({...d,body:'修改后正文'},a));assert(!currentDraftImage({...d,images:[{...d.images[0],prompt:'新画面要求'}]},a));
  assert.throws(()=>imageSelection({...d,body:'修改后正文'},[0]),/正文已修改/);assert.throws(()=>imageSelection(d,[0,0]),/不重复/);
  assert.deepEqual(imageSelection(d),[0,1]);assert.deepEqual(imageSelection({...d,imagesBodyHash:undefined,versions:[{body:d.body}]},[0]),[0]);
  assert.equal(preparedDraftAssets({...d,imageAssets:[{...a,id:'latest',file:'latest.png'},a]}).length,1);
});
test('promotion only attaches matching images, retains human approval gates and avoids replacing a manual project image',()=>{
  const p={draft:d.body,suggestedImagesBodyHash:d.imagesBodyHash,suggestedImageAssets:[a],plan:[{id:'plan',kind:'illustration',...d.images[0]}],assets:[],draftApproved:false,planApproved:false};
  attachPreparedImages(p);assert.equal(p.assets[0].planId,'plan');assert.equal(p.draftApproved,false);assert.equal(p.planApproved,false);
  p.suggestedImageAssets=[{...a,id:'new',file:'new.png'}];attachPreparedImages(p);assert.equal(p.assets.length,1);assert.equal(p.assets[0].file,'new.png');
  p.assets=[{id:'user-upload',file:'manual.png',planId:'plan',draftHash:hash(d.body)}];attachPreparedImages(p);assert.equal(p.assets[0].file,'manual.png');
  const stale={...p,draft:'新正文',assets:[]};attachPreparedImages(stale);assert.equal(stale.assets.length,0);
});
