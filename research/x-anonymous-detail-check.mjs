// Anonymous public page/detail checks through the existing proxy. No JavaScript execution or user sessions.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const run=promisify(execFile),began=new Date();
const output=new URL(`./x-anonymous-detail-${began.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z')}/`,import.meta.url);
await mkdir(output,{recursive:true});
const previous=JSON.parse(await readFile(new URL('./x-public-quality-20261004T184339Z/posts.json',import.meta.url),'utf8'));
const report={beganAt:began.toISOString(),requiresUserLogin:false,executesDownloadedJavaScript:false,productionRadarUpdated:false,results:[]};
const routes=[
  ['X long post 8321','https://x.com/dotey/status/2103685982826471785'],
  ['X long post 7763','https://x.com/dotey/status/2104317565824639146'],
  ['X ChatGPT sample','https://x.com/ChatGPT/status/2106083595433791573'],
  ['X GitHub_Daily sample','https://x.com/GitHub_Daily/status/2104873860390904193'],
  ['FxEmbed self thread A','https://api.fxtwitter.com/2/thread/2104649560257646945'],
  ['FxEmbed self thread B','https://api.fxtwitter.com/2/thread/2104649290668773568'],
  ['Sotwe public asset A','https://www.sotwe.com/_nuxt/e9f9507.js'],
  ['Sotwe public asset B','https://www.sotwe.com/_nuxt/1969be2.js'],
  ['FxEmbed remaining self reply','https://api.fxtwitter.com/2/thread/2104665503621079347'],
];
async function request([label,url],index) {
  const r={label,url,at:new Date().toISOString(),file:`response-${index+1}.txt`};report.results.push(r);
  const args=['--proxy','http://127.0.0.1:9978','--connect-timeout','6','--max-time','16','--location','--max-redirs','3','--compressed',
    '--user-agent','Private-X-Radar-Public-Audit/1.0','--silent','--show-error','--max-filesize','3000000',
    '--output',fileURLToPath(new URL(r.file,output)),'--write-out','%{http_code}\n%{time_total}',url];
  let result;
  try{result=await run('curl.exe',args,{timeout:18500,maxBuffer:10000});r.exitCode=0;}
  catch(e){result={stdout:e.stdout??'',stderr:e.stderr??''};r.exitCode=e.code;r.error=result.stderr.trim().slice(0,200);}
  const [status,seconds]=result.stdout.trim().split('\n');r.httpStatus=Number(status)||null;r.seconds=Number(seconds)||null;
  try {
    const body=await readFile(new URL(r.file,output),'utf8');r.bytes=Buffer.byteLength(body,'utf8');
    r.title=body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]??null;
    if(label.startsWith('X ')) {
      const id=url.split('/').at(-1),fx=previous.find(p=>p.id===id);
      const notes=[...body.matchAll(/note_tweet:[\s\S]*?__typename:"NoteTweet"[\s\S]*?text:("(?:\\.|[^"\\])*")/g)].map(m=>JSON.parse(m[1]));
      const full=[...body.matchAll(/full_text:("(?:\\.|[^"\\])*")/g)].map(m=>JSON.parse(m[1]));
      const options=[...notes,...full];r.noteCharacters=notes.map(s=>[...s].length);r.fullTextCharacters=full.map(s=>[...s].length);
      const bare=s=>s.replace(/https?:\/\/[^\s<>]+/g,'').replace(/\s+/g,' ').trim();
      const matched=options.find(s=>fx&&bare(s)===bare(fx.text));
      r.fxCollectedCharacters=fx?.characters??null;r.fxBodyVerifiedAgainstAnonymousX=Boolean(matched);
      r.matchedCharacters=matched?[...matched].length:null;r.matchedTextHash=matched?createHash('sha256').update(matched).digest('hex'):null;
      r.exactTextMatch=!!fx&&options.includes(fx.text);
      r.containsRequestedPostID=body.includes(`rest_id:"${id}"`);
      r.rawURLDifferencesIgnoredInBareTextComparison=true;
    } else if(label.startsWith('FxEmbed')) {
      const d=JSON.parse(body);r.providerCode=d.code;const items=d.thread??d.results??[];
      r.threadIds=items.map(p=>p.id);r.threadAuthorCounts=items.reduce((o,p)=>(o[p.author?.screen_name??'unknown']=(o[p.author?.screen_name??'unknown']??0)+1,o),{});
      r.continuation=d.cursor?.bottom??null;r.firstKeys=Object.keys(d);
    } else {
      r.publicAPISnippets=[...body.matchAll(/.{0,100}(?:\/user\/|\/timeline|apiUrl|baseURL|after:|nextCursor|userTimeline|fetchTimeline).{0,150}/g)].slice(0,14).map(m=>m[0]);
    }
  }catch(e){r.parseError=e.message;}
  console.log(JSON.stringify({label,status:r.httpStatus,bytes:r.bytes,verified:r.fxBodyVerifiedAgainstAnonymousX,note:r.noteCharacters,thread:r.threadIds?.length}));
}
for(let i=0;i<routes.length;i+=2) {
  const outcomes=await Promise.allSettled(routes.slice(i,i+2).map((route,j)=>request(route,i+j)));
  for(const outcome of outcomes)if(outcome.status==='rejected')throw outcome.reason;
}
report.finishedAt=new Date().toISOString();
await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({stage:'finished',directory:fileURLToPath(output)}));
