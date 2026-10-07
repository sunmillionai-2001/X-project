// Public requests through the existing local system proxy. No cookies, browser profile or credentials.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const run=promisify(execFile);
const began=new Date();
const output=new URL(`./x-public-network-${began.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z')}/`,import.meta.url);
await mkdir(output,{recursive:true});
const urls=[
  ['FxEmbed JSON','https://api.fxtwitter.com/2/profile/dotey/statuses?count=20'],
  ['Nitter poast RSS','https://nitter.poast.org/dotey/rss'],
  ['Nitter catsarch RSS','https://nitter.catsarch.com/dotey/rss'],
  ['RSSHub public RSS','https://rsshub.app/twitter/user/dotey'],
  ['OpenRSS public RSS','https://openrss.org/x.com/dotey'],
  ['TwStalker HTML','https://twstalker.com/dotey'],
  ['Sotwe HTML','https://www.sotwe.com/dotey'],
  ['Jina Reader','https://r.jina.ai/https://x.com/dotey'],
  ['Direct anonymous X HTML','https://x.com/dotey'],
  ['X榜单 HTML','https://xbangdan.com/intel/'],
];
const report={beganAt:began.toISOString(),transport:'Existing Windows HTTP proxy, configured on loopback; no system settings changed.',
  requiresUserLogin:false,usesBrowserSession:false,usesOfficialDeveloperAPI:false,results:[]};
async function request([label,url],index) {
  const file=`response-${index+1}.txt`,head=`headers-${index+1}.txt`;
  const r={label,url,at:new Date().toISOString(),file};report.results.push(r);
  const args=['--proxy','http://127.0.0.1:9978','--connect-timeout','6','--max-time','16','--location','--max-redirs','3','--compressed',
    '--user-agent','Private-X-Radar-Public-Audit/1.0','--silent','--show-error','--dump-header',fileURLToPath(new URL(head,output)),
    '--output',fileURLToPath(new URL(file,output)),'--write-out','%{http_code}\n%{time_total}\n%{url_effective}',url];
  let result;
  try {result=await run('curl.exe',args,{timeout:18500,maxBuffer:10000});r.curlExitCode=0;}
  catch(error){result={stdout:error.stdout??'',stderr:error.stderr??''};r.curlExitCode=error.code;r.error=result.stderr.trim().slice(0,220);}
  const [status,seconds,effective]=result.stdout.trim().split('\n');r.httpStatus=Number(status)||null;r.seconds=Number(seconds)||null;r.effectiveURL=effective??null;
  try {
    const bytes=await readFile(new URL(file,output));r.bytes=bytes.length;
    const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    r.rss=/<rss\b|<feed\b/i.test(body);r.items=[...body.matchAll(/<item\b/gi)].length;
    r.title=body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]??null;
    r.scriptURLs=[...body.matchAll(/<script[^>]*src=["']([^"']+)/gi)].map(m=>m[1]);
    r.xPostLinkCount=[...body.matchAll(/(?:x|twitter)\.com\/\w+\/status\/\d+/gi)].length;
    r.loginIndicator=/Log in to X|Sign in to X|登录 X|Log in to continue/i.test(body);
    r.challengeIndicator=/Just a moment|cf-chl-|challenge-platform|verify you are human/i.test(body);
    try {const j=JSON.parse(body);r.jsonCode=j.code??null;r.jsonItems=j.results?.length??null;}catch{}
    if(label==='X榜单 HTML'&&r.httpStatus===200) {
      r.dataReferences=[...new Set([...body.matchAll(/(?:fetch\(|\/api\/|\.json\b|\.sqlite\b)[^\n]{0,140}/g)].map(m=>m[0]))].slice(0,20);
    }
    r.preview=body.slice(0,160);
  }catch(error){r.bodyReadError=error.message;}
  console.log(JSON.stringify({label,status:r.httpStatus,curlExit:r.curlExitCode,seconds:r.seconds,bytes:r.bytes,rss:r.rss,items:r.items,title:r.title,jsonItems:r.jsonItems}));
}
for(let i=0;i<urls.length;i+=2) {
  const results=await Promise.allSettled(urls.slice(i,i+2).map((x,j)=>request(x,i+j)));
  for(const result of results)if(result.status==='rejected')throw result.reason;
}
report.finishedAt=new Date().toISOString();
await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({stage:'finished',directory:fileURLToPath(output)}));
