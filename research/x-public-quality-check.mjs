// Read-only supplemental audit of anonymous public services; no user session or model calls.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const previous = JSON.parse(await readFile(new URL('./x-public-history-20261004T183748Z/report.json', import.meta.url), 'utf8'));
const correction = JSON.parse(await readFile(new URL('./x-public-history-20261004T184227Z/report.json', import.meta.url), 'utf8'));
const histories = [...previous.histories.filter(h => h.handle !== 'GitHubDaily'), ...correction.histories];
const start = Date.parse(previous.windowStart), end = Date.parse(previous.windowEnd);
const since = new Date(start - 86400000).toISOString().slice(0,10);
const until = new Date(end + 86400000).toISOString().slice(0,10);
const began = new Date();
const output = new URL(`./x-public-quality-${began.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}/`, import.meta.url);
await mkdir(output, { recursive:true });
const report = { beganAt:began.toISOString(), windowStart:previous.windowStart, windowEnd:previous.windowEnd,
  requiresUserLogin:false, modelCalls:0, productionRadarUpdated:false, histories:histories.map(({posts,...h})=>h),
  correction:'The website display name GitHubDaily resolves to @GitHub_Daily. The unrelated @GitHubDaily is excluded.',
  roots:[], feeds:[], authorResearch:[], repeat:[], accuracy:[], calls:[] };
let sequence=0;
const halted=new Set();
const digest=text=>createHash('sha256').update(text).digest('hex');
const inWindow=p=>p.publishedMs>=start && p.publishedMs<=end;
async function request(url,label,format='json') {
  const call={id:++sequence,label,url,at:new Date().toISOString()};report.calls.push(call);
  const host=new URL(url).hostname;
  if(halted.has(host)){call.outcome='skipped_after_rate_limit';return {call};}
  const t0=Date.now();
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(14000),headers:{'User-Agent':'Private-X-Radar-Public-Audit/1.0'}});
    call.httpStatus=response.status;call.cacheAge=response.headers.get('age');
    if(response.status===429)halted.add(host);
    const chunks=[];let size=0;
    for await(const chunk of response.body??[]) {size+=chunk.length;if(size>3000000)throw new Error('Response size exceeded');chunks.push(Buffer.from(chunk));}
    const body=Buffer.concat(chunks).toString('utf8');call.bytes=size;
    if(!response.ok){call.outcome='http_error';return {call};}
    if(format==='feed') {
      call.outcome=/<rss\b|<feed\b/i.test(body)?'feed_received':'html_only';
      if(call.outcome==='feed_received'){call.file=`response-${call.id}.xml`;await writeFile(new URL(call.file,output),body,'utf8');}
      return {call,body};
    }
    const data=JSON.parse(body);call.providerCode=data.code??null;
    if(data.code && data.code!==200){call.outcome='provider_error';return {call};}
    call.outcome='json_received';call.file=`response-${call.id}.json`;
    await writeFile(new URL(call.file,output),JSON.stringify(data,null,2)+'\n','utf8');return {call,data};
  } catch(error) {call.outcome='request_failed';call.error=error.message;return {call};}
  finally {call.elapsedMs=Date.now()-t0;console.log(JSON.stringify({id:call.id,label,status:call.httpStatus,outcome:call.outcome,ms:call.elapsedMs}));}
}
function normalize(t) {
  if(!t || t.type==='tombstone' || t.author?.protected)return null;
  const id=String(t.id??t.tweetID??''),author=t.author?.screen_name??t.user_screen_name,text=t.text;
  const publishedMs=(t.created_timestamp??t.date_epoch)*1000 || Date.parse(t.created_at??t.date);
  if(!/^\d{2,20}$/.test(id) || !/^[A-Za-z0-9_]{1,15}$/.test(author??'') || !text?.trim() || !Number.isFinite(publishedMs))return null;
  const replying=typeof t.replying_to==='object'?t.replying_to:null;
  return {id,author,text,textHash:digest(text),characters:[...text].length,publishedMs,publishedAt:new Date(publishedMs).toISOString(),
    url:`https://x.com/${author}/status/${id}`,replyToId:replying?.status??t.replying_to_status??t.replyingToID??null,
    repostedBy:t.reposted_by?.screen_name??null,dateMatchesSnowflake:Math.abs(publishedMs-Number((BigInt(id)>>22n)+1288834974657n))<2000};
}
async function rootSearch(handle) {
  const query=`from:${handle} since:${since} until:${until} -filter:retweets -filter:replies`;
  const seen=new Map(),pages=[],cursors=new Set();let cursor='',stop='page_limit';
  for(let page=1;page<=12;page++) {
    const u=new URL('https://api.fxtwitter.com/2/search');u.search=new URLSearchParams({q:query,feed:'latest',count:'100',...(cursor?{cursor}:{})});
    const {call,data}=await request(u.href,`root search @${handle} page ${page}`);
    if(!Array.isArray(data?.results)){stop='request_or_schema_failure';break;}
    const rows=data.results.map(normalize).filter(Boolean),fresh=rows.filter(p=>!seen.has(p.id));rows.forEach(p=>seen.set(p.id,p));
    pages.push({page,requestId:call.id,returned:data.results.length,newIds:fresh.length});
    if(!data.results.length){stop='empty_page';break;}
    if(!fresh.length){stop='repeated_page';break;}
    if(!data.cursor?.bottom){stop='no_next_cursor';break;}
    if(cursors.has(data.cursor.bottom)){stop='repeated_cursor';break;}
    cursors.add(data.cursor.bottom);cursor=data.cursor.bottom;
  }
  const posts=[...seen.values()].filter(p=>inWindow(p)&&p.author.toLowerCase()===handle.toLowerCase()&&!p.replyToId&&!p.repostedBy);
  const timeline=histories.find(h=>h.handle===handle).posts.filter(p=>inWindow(p)&&p.own&&!p.replyToId);
  const result={handle,query,stop,pages,searchRootCount:posts.length,timelineRootCount:timeline.length,
    searchOnly:posts.filter(p=>!timeline.some(t=>t.id===p.id)),timelineOnly:timeline.filter(p=>!posts.some(t=>t.id===p.id)).map(p=>({id:p.id,url:p.url})),
    textDisagreements:posts.filter(p=>timeline.some(t=>t.id===p.id&&t.textHash!==p.textHash)).map(p=>p.id),posts};
  report.roots.push(result);
  console.log(JSON.stringify({stage:'root_comparison',handle,stop,pages:pages.length,search:posts.length,timeline:timeline.length,searchOnly:result.searchOnly.length,timelineOnly:result.timelineOnly.length}));
}
await rootSearch('dotey');
await rootSearch('GitHub_Daily');

const feed=await request('https://fxtwitter.com/GitHub_Daily/feed.xml?count=100','corrected GitHub_Daily RSS','feed');
const items=feed.body?[...feed.body.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>m[1]):[];
const ids=items.map(item=>item.match(/<link>[^<]*\/status\/(\d+)/)?.[1]).filter(Boolean);
report.feeds.push({handle:'GitHub_Daily',requestId:feed.call.id,outcome:feed.call.outcome,items:items.length,
  timelineIdsMissing:histories.find(h=>h.handle==='GitHub_Daily').posts.filter(p=>!ids.includes(p.id)).map(p=>p.id)});

for(const query of ['from:jedeeai (API OR 接口 OR 抓取 OR 爬虫 OR 数据源)','from:jedeeai twitterapi','from:jedeeai 情报','from:jedeeai 榜单']) {
  const u=new URL('https://api.fxtwitter.com/2/search');u.search=new URLSearchParams({q:query,feed:'latest',count:'20'});
  const {call,data}=await request(u.href,`author research ${query}`);
  report.authorResearch.push({query,requestId:call.id,outcome:call.outcome,posts:Array.isArray(data?.results)?data.results.map(normalize).filter(Boolean):[]});
}

for(const {handle} of histories) {
  const {call,data}=await request(`https://api.fxtwitter.com/2/profile/${handle}/statuses?count=20`,`later repeat @${handle}`);
  const posts=Array.isArray(data?.results)?data.results.map(normalize).filter(Boolean):[];
  const first=previous.stability[0].accounts.find(a=>a.handle===handle);
  const base=first?.posts ?? correction.histories.find(h=>h.handle===handle)?.posts ?? [];
  const common=posts.filter(p=>base.some(b=>b.id===p.id));
  report.repeat.push({handle,requestId:call.id,at:call.at,ok:call.outcome==='json_received'&&posts.length>0,count:posts.length,
    elapsedSinceFirstSeconds:first?(Date.parse(call.at)-Date.parse(previous.stability[0].at))/1000:null,
    common:common.length,textChanges:common.filter(p=>base.find(b=>b.id===p.id).textHash!==p.textHash).map(p=>p.id)});
}
const correctedPost=histories.find(h=>h.handle==='GitHub_Daily').posts.filter(p=>p.own).toSorted((a,b)=>b.characters-a.characters)[0];
const searchOnly=report.roots.flatMap(s=>s.searchOnly).slice(0,3);
for(const post of [correctedPost,...searchOnly].filter(Boolean)) {
  const fx=await request(`https://api.fxtwitter.com/status/${post.id}`,`FxEmbed detail ${post.id}`);
  const vx=await request(`https://api.vxtwitter.com/${post.author}/status/${post.id}`,`Vx detail ${post.id}`);
  const a=normalize(fx.data?.tweet??fx.data?.status),b=normalize(vx.data);
  report.accuracy.push({id:post.id,author:post.author,url:post.url,fxSuccess:!!a,vxSuccess:!!b,fxMatchesCollectedText:a?.textHash===post.textHash,
    fxCharacters:a?.characters??null,vxCharacters:b?.characters??null,sameText:a&&b?a.textHash===b.textHash:null,
    sameAuthor:a&&b?a.author.toLowerCase()===b.author.toLowerCase():null,sameTime:a&&b?a.publishedAt===b.publishedAt:null});
}
const timelinePosts=[...new Map(histories.flatMap(h=>h.posts.filter(inWindow)).map(p=>[p.id,p])).values()];
const unionPosts=[...new Map([...timelinePosts,...report.roots.flatMap(s=>s.posts)].map(p=>[p.id,p])).values()].sort((a,b)=>b.publishedMs-a.publishedMs);
report.uniqueTimelinePosts=timelinePosts.length;report.uniqueTimelineAndRootSearchPosts=unionPosts.length;
report.finishedAt=new Date().toISOString();
await writeFile(new URL('posts.json',output),JSON.stringify(unionPosts,null,2)+'\n','utf8');
await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({stage:'finished',directory:fileURLToPath(output),calls:report.calls.length,timelinePosts:timelinePosts.length,unionPosts:unionPosts.length}));
