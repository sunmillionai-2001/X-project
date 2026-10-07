// Historical public-X audit. No X login, cookies, official API or model calls.
// node research/x-public-history-check.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const began = new Date();
const end = began.getTime();
const start = end - 12 * 86400000;
const handleArgument = process.argv.find(arg => arg.startsWith('--handles='));
const handles = handleArgument ? handleArgument.slice('--handles='.length).split(',') : ['ChatGPT', 'OpenAI', 'dotey', 'karpathy', 'GitHub_Daily', 'jedeeai'];
if (!handles.length || handles.some(handle => !/^[A-Za-z0-9_]{1,15}$/.test(handle))) throw new Error('Invalid public account handle');
const historyOnly = process.argv.includes('--history-only');
const digest = text => createHash('sha256').update(text).digest('hex');
const output = new URL(`./x-public-history-${began.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/, 'Z')}/`, import.meta.url);
await mkdir(output, { recursive: true });
const calls = [];
const haltedHosts = new Set();
let sequence = 0;
const report = {
  beganAt: began.toISOString(), windowStart: new Date(start).toISOString(), windowEnd: began.toISOString(),
  days: 12, requiresUserLogin: false, usesOfficialDeveloperAPI: false,
  productionRadarUpdated: false, modelCalls: 0,
  histories: [], searchChecks: [], feeds: [], accuracy: [], stability: [], authorResearch: [], calls,
};
async function saveReport() {
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2) + '\n', 'utf8');
}
async function pairMap(items, fn) {
  const results = [];
  for (let i=0; i<items.length; i+=2) {
    const batch = await Promise.allSettled(items.slice(i,i+2).map(fn));
    for (const value of batch) {
      if (value.status !== 'fulfilled') throw value.reason;
      results.push(value.value);
    }
  }
  return results;
}
async function request(url, label, format='json') {
  const call = { id: ++sequence, label, url, beganAt: new Date().toISOString() };
  calls.push(call);
  const host = new URL(url).hostname;
  if (haltedHosts.has(host)) { call.outcome='skipped_after_rate_limit'; return { call }; }
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(14000), headers: { 'User-Agent': 'Private-X-Radar-Public-Audit/1.0' } });
    call.httpStatus=r.status; call.contentType=r.headers.get('content-type');
    call.cacheAge=r.headers.get('age');
    if (r.status===429) { haltedHosts.add(host); call.retryAfter=r.headers.get('retry-after'); }
    const chunks=[]; let bytes=0;
    for await (const chunk of r.body ?? []) {
      bytes += chunk.length;
      if (bytes>3000000) throw new Error('Response exceeds audit size limit');
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString('utf8');
    call.bytes=bytes;
    if (!r.ok) {
      call.outcome='http_error'; call.error=body.slice(0,160);
      return { call };
    }
    if (format==='json') {
      const data=JSON.parse(body); call.providerCode=data.code ?? null;
      if (data.code && data.code!==200) { call.outcome='provider_error'; return {call}; }
      call.outcome='json_received';
      call.bodyFile=`response-${String(call.id).padStart(3,'0')}.json`;
      await writeFile(new URL(call.bodyFile,output),JSON.stringify(data,null,2)+'\n','utf8');
      return {call,data};
    }
    const rss=/<rss\b|<feed\b/i.test(body);
    call.outcome=rss?'feed_received':'html_only';
    if (rss) {
      call.bodyFile=`response-${String(call.id).padStart(3,'0')}.xml`;
      await writeFile(new URL(call.bodyFile,output),body,'utf8');
    } else {
      call.pageTitle=body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null;
      call.snippet=body.slice(0,160);
    }
    return {call,body};
  } catch(e) {
    call.outcome='request_failed'; call.error=e.message; call.errorCode=e.cause?.code ?? null;
    return {call};
  } finally {
    call.elapsedMs=Date.now()-t0;
    console.log(JSON.stringify({request:call.id,label,status:call.httpStatus,outcome:call.outcome,ms:call.elapsedMs}));
  }
}
function normalize(t, watched) {
  if (!t || t.type==='tombstone' || t.author?.protected) return null;
  const id=String(t.id ?? t.tweetID ?? '');
  const author=t.author?.screen_name ?? t.user_screen_name;
  const text=t.text;
  if (!/^\d{2,20}$/.test(id) || !/^[A-Za-z0-9_]{1,15}$/.test(author ?? '') || typeof text!=='string' || !text.trim()) return null;
  const ms=(t.created_timestamp ?? t.date_epoch)*1000 || Date.parse(t.created_at ?? t.date);
  if (!Number.isFinite(ms)) return null;
  const idMs=Number((BigInt(id)>>22n)+1288834974657n);
  const reply=typeof t.replying_to==='object' ? t.replying_to : null;
  return {
    id, author, url:`https://x.com/${author}/status/${id}`, watchedAccount:watched ?? null,
    publishedAt:new Date(ms).toISOString(), publishedMs:ms,
    dateMatchesSnowflake:Math.abs(ms-idMs)<2000, text, textHash:digest(text), characters:[...text].length,
    isLongPost:t.is_note_tweet ?? null,
    replyToId:reply?.status ?? t.replying_to_status ?? t.replyingToID ?? null,
    replyToAuthor:reply?.screen_name ?? (typeof t.replying_to==='string'?t.replying_to:t.replyingTo) ?? null,
    repostedBy:t.reposted_by?.screen_name ?? null,
    own:watched ? author.toLowerCase()===watched.toLowerCase() && !t.reposted_by : null,
    metrics:{likes:t.likes ?? null,replies:t.replies ?? null,reposts:t.reposts ?? t.retweets ?? null,views:t.views ?? null},
    media:t.media ?? t.media_extended ?? null,
  };
}
const inWindow=p=>p.publishedMs>=start && p.publishedMs<=end;
const relevantOwn=(p,handle)=>p.author.toLowerCase()===handle.toLowerCase() && !p.repostedBy && (!p.replyToId || p.replyToAuthor?.toLowerCase()===handle.toLowerCase());
function stats(posts,handle) {
  const rows=posts.filter(inWindow);
  const own=rows.filter(p=>p.own);
  const dates=own.map(p=>p.publishedAt).sort();
  const byDay={};
  for(const p of own) {
    const day=new Date(p.publishedMs+8*3600000).toISOString().slice(0,10);
    byDay[day]=(byDay[day]??0)+1;
  }
  return {handle,uniqueWindowPosts:rows.length,ownWindowPosts:own.length,ownRootPosts:own.filter(p=>!p.replyToId).length,
    ownContinuationPosts:own.filter(p=>p.replyToId).length,otherAuthors:rows.filter(p=>!p.own).length,
    earliestOwn:dates[0]??null,latestOwn:dates.at(-1)??null,byBeijingDay:byDay,
    longestOwnCharacters:own.length?Math.max(...own.map(p=>p.characters)):0,
    inconsistentDates:rows.filter(p=>!p.dateMatchesSnowflake).map(p=>p.id)};
}
async function history(handle) {
  const seen=new Map(); const pages=[]; const usedCursors=new Set();
  let cursor=''; let stop='page_limit';
  for(let page=1;page<=10;page++) {
    const u=new URL(`https://api.fxtwitter.com/2/profile/${handle}/statuses`);
    u.searchParams.set('count','100'); if(cursor)u.searchParams.set('cursor',cursor);
    const {call,data}=await request(u.href,`history @${handle} page ${page}`);
    if(!data || !Array.isArray(data.results)) {stop='request_or_schema_failure';break;}
    const rows=data.results.map(t=>normalize(t,handle)).filter(Boolean);
    const fresh=rows.filter(p=>!seen.has(p.id));
    for(const p of rows)seen.set(p.id,p);
    const own=rows.filter(p=>p.own);
    const entry={page,requestId:call.id,returned:data.results.length,valid:rows.length,newIds:fresh.length,
      oldestOwn:own.length?new Date(Math.min(...own.map(p=>p.publishedMs))).toISOString():null,
      newestOwn:own.length?new Date(Math.max(...own.map(p=>p.publishedMs))).toISOString():null,
      hasMore:Boolean(data.cursor?.bottom)};
    pages.push(entry);
    if(!data.results.length) {stop='provider_empty_page';break;}
    if(!fresh.length) {stop='repeated_page';break;}
    // An old repost or a pinned post on page 1 is not a date boundary.
    if(page>=2 && own.length>=2 && own.every(p=>p.publishedMs<start)) {stop='older_own_page_reached';break;}
    const next=data.cursor?.bottom;
    if(!next) {stop='no_next_cursor';break;}
    if(next===cursor || usedCursors.has(next)) {stop='repeated_cursor';break;}
    usedCursors.add(next); cursor=next;
  }
  const posts=[...seen.values()];
  const result={...stats(posts,handle),pages,stop,boundaryReached:['older_own_page_reached','provider_empty_page','no_next_cursor'].includes(stop),
    coverageGuarantee:false,posts:posts.filter(inWindow)};
  report.histories.push(result); await saveReport();
  console.log(JSON.stringify({stage:'history_done',handle,stop,pages:pages.length,own:result.ownWindowPosts,earliest:result.earliestOwn}));
  return result;
}

report.histories=[];
await pairMap(handles,history);
await saveReport();

async function stabilityRound(round) {
  const rows=await pairMap(handles,async handle=>{
    const {call,data}=await request(`https://api.fxtwitter.com/2/profile/${handle}/statuses?count=20`,`stability ${round} @${handle}`);
    const posts=Array.isArray(data?.results)?data.results.map(t=>normalize(t,handle)).filter(Boolean):[];
    const base=report.stability.find(r=>r.round===1)?.accounts.find(a=>a.handle===handle);
    const common=base?posts.filter(p=>base.posts.some(b=>b.id===p.id)):[];
    return {handle,requestId:call.id,ok:call.outcome==='json_received'&&posts.length>0,
      count:posts.length,ids:posts.map(p=>p.id),posts:posts.map(p=>({id:p.id,textHash:p.textHash})),
      commonWithFirst:base?common.length:null,textChangesWithFirst:base?common.filter(p=>base.posts.find(b=>b.id===p.id).textHash!==p.textHash).map(p=>p.id):null};
  });
  report.stability.push({round,at:new Date().toISOString(),accounts:rows});await saveReport();
}
if (!historyOnly) {
await stabilityRound(1);

const feedUrls=handles.map(handle=>({name:`FxEmbed RSS @${handle}`,handle,backend:'FxEmbed',url:`https://fxtwitter.com/${handle}/feed.xml?count=100`}));
feedUrls.push(
  {name:'FixupX RSS',handle:'dotey',backend:'FxEmbed (same upstream)',url:'https://fixupx.com/dotey/feed.xml?count=100'},
  {name:'OpenRSS public feed',handle:'dotey',backend:'OpenRSS (independence unverified)',url:'https://openrss.org/x.com/dotey'},
  {name:'RSSHub public demo',handle:'dotey',backend:'RSSHub',url:'https://rsshub.app/twitter/user/dotey'},
  {name:'Nitter poast RSS',handle:'dotey',backend:'Nitter poast',url:'https://nitter.poast.org/dotey/rss'},
  {name:'Nitter catsarch RSS',handle:'dotey',backend:'Nitter catsarch',url:'https://nitter.catsarch.com/dotey/rss'},
  {name:'TwStalker public page',handle:'dotey',backend:'TwStalker',url:'https://twstalker.com/dotey'},
  {name:'Sotwe public page',handle:'dotey',backend:'Sotwe',url:'https://www.sotwe.com/dotey'},
  {name:'Jina public reader',handle:'dotey',backend:'Jina',url:'https://r.jina.ai/https://x.com/dotey'},
);
await pairMap(feedUrls,async source=>{
  const {call,body}=await request(source.url,source.name,'feed');
  const items=body&&/<rss\b/i.test(body)?[...body.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>m[1]):[];
  const rows=items.map(xml=>{
    const link=xml.match(/<link>\s*([^<]+)\s*<\/link>/i)?.[1];
    const id=link?.match(/\/status\/(\d+)/)?.[1];
    const author=link?.match(/(?:x|twitter)\.com\/([^/]+)\/status\//)?.[1];
    const date=Date.parse(xml.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1]??'');
    return{id,author,publishedMs:date,url:link};
  }).filter(p=>p.id&&Number.isFinite(p.publishedMs));
  const dates=rows.map(p=>new Date(p.publishedMs).toISOString()).sort();
  const windowIds=rows.filter(inWindow).map(p=>p.id);
  const expected=report.histories.find(h=>h.handle===source.handle)?.posts??[];
  const result={...source,requestId:call.id,outcome:call.outcome,totalItems:items.length,validItems:rows.length,
    earliest:dates[0]??null,latest:dates.at(-1)??null,windowCount:windowIds.length,windowIds,
    timelineWindowIdsMissingFromFeed:expected.filter(p=>!windowIds.includes(p.id)).map(p=>p.id),
    timelineCrossCheckApplicable:call.outcome==='feed_received',coverageGuarantee:false};
  report.feeds.push(result);await saveReport();
});

const sinceDate=new Date(start-86400000).toISOString().slice(0,10);
const untilDate=new Date(end+86400000).toISOString().slice(0,10);
for(const handle of handles.filter(handle => ['dotey','GitHub_Daily'].includes(handle))) {
  const query=`from:${handle} since:${sinceDate} until:${untilDate} -filter:retweets`;
  let cursor='';const seen=new Map();const pages=[];let stop='page_limit';
  for(let page=1;page<=5;page++) {
    const u=new URL('https://api.fxtwitter.com/2/search');
    u.search=new URLSearchParams({q:query,feed:'latest',count:'100',...(cursor?{cursor}:{})});
    const {call,data}=await request(u.href,`dated search @${handle} page ${page}`);
    if(!data||!Array.isArray(data.results)){stop='request_or_schema_failure';break;}
    const rows=data.results.map(t=>normalize(t,handle)).filter(Boolean);
    const fresh=rows.filter(p=>!seen.has(p.id));for(const p of rows)seen.set(p.id,p);
    pages.push({page,requestId:call.id,returned:data.results.length,valid:rows.length,newIds:fresh.length});
    if(!rows.length){stop='empty_page';break;}
    if(!fresh.length){stop='repeated_page';break;}
    if(!data.cursor?.bottom){stop='no_next_cursor';break;}
    if(data.cursor.bottom===cursor){stop='repeated_cursor';break;}
    cursor=data.cursor.bottom;
  }
  const posts=[...seen.values()].filter(inWindow);
  const comparable=posts.filter(p=>relevantOwn(p,handle));
  const timeline=report.histories.find(h=>h.handle===handle).posts.filter(p=>relevantOwn(p,handle));
  report.searchChecks.push({handle,query,stop,pages,windowPosts:posts.length,comparablePosts:comparable.length,
    timelineRelevantPosts:timeline.length,
    searchOnly:comparable.filter(p=>!timeline.some(t=>t.id===p.id)).map(p=>({id:p.id,replyToId:p.replyToId,url:p.url})),
    timelineOnly:timeline.filter(p=>!comparable.some(t=>t.id===p.id)).map(p=>({id:p.id,replyToId:p.replyToId,url:p.url})),
    textDisagreements:comparable.filter(p=>timeline.some(t=>t.id===p.id&&t.textHash!==p.textHash)).map(p=>p.id),posts});
  await saveReport();
}
await stabilityRound(2);

const candidates=report.histories.flatMap(h=>h.posts).filter(p=>p.own);
const chinese= candidates.filter(p=>p.author.toLowerCase()==='dotey').sort((a,b)=>b.characters-a.characters);
const earliest=candidates.toSorted((a,b)=>a.publishedMs-b.publishedMs);
const picks=[chinese[0],chinese[1],earliest[0],earliest.find(p=>p.author.toLowerCase()==='github_daily'),
  candidates.find(p=>p.id==='2106083595433791573'),candidates.find(p=>p.author.toLowerCase()==='jedeeai')].filter(Boolean);
for(const p of [...new Map(picks.map(p=>[p.id,p])).values()]) {
  const a=await request(`https://api.fxtwitter.com/status/${p.id}`,`FxEmbed verify ${p.id}`);
  const b=await request(`https://api.vxtwitter.com/${p.author}/status/${p.id}`,`VxTwitter verify ${p.id}`);
  const fxPost=normalize(a.data?.tweet??a.data?.status,p.author);
  const vxPost=normalize(b.data,p.author);
  const links=s=>[...(s??'').matchAll(/https?:\/\/[^\s<>]+/g)].map(m=>m[0]);
  const bare=s=>(s??'').replace(/https?:\/\/[^\s<>]+/g,'').replace(/\s+/g,' ').trim();
  report.accuracy.push({id:p.id,author:p.author,url:p.url,publishedAt:p.publishedAt,characters:p.characters,
    timelineDateMatchesSnowflake:p.dateMatchesSnowflake,fxRequest:a.call.id,vxRequest:b.call.id,
    fxSuccess:Boolean(fxPost),vxSuccess:Boolean(vxPost),
    fxTimelineTextSame:fxPost?fxPost.textHash===p.textHash:null,
    sameId:fxPost&&vxPost?fxPost.id===vxPost.id:null,
    sameAuthor:fxPost&&vxPost?fxPost.author.toLowerCase()===vxPost.author.toLowerCase():null,
    samePublishedTime:fxPost&&vxPost?fxPost.publishedAt===vxPost.publishedAt:null,
    exactTextSame:fxPost&&vxPost?fxPost.text===vxPost.text:null,
    nonUrlTextSame:fxPost&&vxPost?bare(fxPost.text)===bare(vxPost.text):null,
    fxCharacters:fxPost?.characters??null,vxCharacters:vxPost?.characters??null,
    fxLinks:links(fxPost?.text),vxLinks:links(vxPost?.text),independentUpstreamsEstablished:false});
  await saveReport();
}

for(const query of ['from:jedeeai xbangdan','from:jedeeai 爬虫','from:jedeeai 采集']) {
  const u=new URL('https://api.fxtwitter.com/2/search');u.search=new URLSearchParams({q:query,feed:'latest',count:'20'});
  const {call,data}=await request(u.href,`author research ${query}`);
  const posts=Array.isArray(data?.results)?data.results.map(t=>normalize(t,'jedeeai')).filter(Boolean):[];
  report.authorResearch.push({query,requestId:call.id,outcome:call.outcome,posts});await saveReport();
}
await stabilityRound(3);
}

report.finishedAt=new Date().toISOString();
report.shortTermStabilityDurationSeconds=report.stability.length ? (Date.parse(report.stability.at(-1).at)-Date.parse(report.stability[0].at))/1000 : null;
const posts=[...new Map(report.histories.flatMap(h=>h.posts).map(p=>[p.id,p])).values()].sort((a,b)=>b.publishedMs-a.publishedMs);
report.uniqueWindowPosts=posts.length;
report.limits=['No personal X session or credentials used.',
  'Pagination boundaries do not prove complete account coverage.',
  'RSS/JSON/alternate FxEmbed hostnames share an upstream.',
  'Search and timeline may have different indexing and reply scopes.',
  'Three rounds within one session do not prove long-term availability.',
  'Content consistency checks do not verify the truth of claims in posts.'];
await writeFile(new URL('posts.json',output),JSON.stringify(posts,null,2)+'\n','utf8');
await saveReport();
console.log(JSON.stringify({stage:'finished',directory:fileURLToPath(output),requests:calls.length,
  uniqueWindowPosts:posts.length,stabilitySeconds:report.shortTermStabilityDurationSeconds,
  histories:report.histories.map(({handle,ownWindowPosts,pages,stop,earliestOwn})=>({handle,ownWindowPosts,pages:pages.length,stop,earliestOwn}))}));
