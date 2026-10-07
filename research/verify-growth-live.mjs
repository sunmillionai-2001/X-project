import fs from 'node:fs';
const base='http://127.0.0.1:8770';
async function request(route,value){const r=await fetch(base+route,value===undefined?{}:{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(value)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
async function job(route,value){let j=await request(route,value);console.log(JSON.stringify({route,id:j.id,status:j.status}));let last='';while(j.status==='running'){await new Promise(r=>setTimeout(r,1200));j=await request('/api/job/'+j.id);if(j.message!==last){last=j.message;console.log(last);}}if(j.status!=='done')throw Error(j.error);return j.result;}
const s=await request('/api/state');
const reference=s.growth.references.find(r=>r.id==='2104911243739853231');
if(!reference)throw Error('真实参考长文不在当前缓存');
const a=s.growth.analyses.find(a=>a.reference.id===reference.id) || await job('/api/growth/analyze',{mode:'cached',handle:reference.handle,postId:reference.id});
console.log(JSON.stringify({analysisId:a.id,title:a.title,evidenceChars:a.evidence.reduce((n,e)=>n+[...e.quote].length,0),steps:a.structure.length}));
const ownMaterial='这是一份由工作台开发者整理的功能演示材料，不是用户的个人亲测经历，也不提供效率提升或涨粉数据。我们给普通读者做 AI 工具图文时，先明确读者想完成的具体任务，例如整理一份清单、比较几个选项、完成一个操作步骤。写作前把原始资料、自己的判断和还没核实的地方分开记录。展示实际操作需要真实截图；解释一个步骤、一个选择或一个框架，可以使用明确标注的原创示意图。封面只提出一个清楚的问题，正文中的解释图要与段落对应。流程适合有顺序的操作；对比适合介绍差异和选择条件；清单适合发布前检查。正文和图片里的标签应一致，同一篇尽量保持统一色板和字体。生成之后，需要人检查具体说法、文字和图片是否一致，以及有没有把材料中未说明的内容说成已验证。公开帖子由人手动发布。后续若记录阅读和收藏，应同时记录观察时间与发布时间，不能将不同帖龄的累计数直接解释为内容优劣。以上只是准备图文的方法建议，尚没有读者实验结果，不承诺增长。';
const d=await job('/api/growth/create',{analysisId:a.id,topic:'功能演示：普通人的 AI 图文，怎样选封面和解释图',ownAngle:'把配图当作解释读者任务的工具，给出流程、对比与清单的选择方法；明确这是方法演示而非个人实测。',ownMaterial});
const report={checkedAt:new Date().toISOString(),model:s.settings.textModel,analysisId:a.id,referenceURL:a.reference.url,inputLength:a.reference.text.length,quoteChars:a.evidence.reduce((n,e)=>n+[...e.quote].length,0),draftId:d.id,bodyLength:[...d.body].length,images:d.images.length,overlaps:d.overlaps.length,autoApproved:false,autoPublished:false};
fs.writeFileSync(new URL('./x-growth-live-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report));
