import {cached,failure,json} from '@/lib/server';
import {getXToken} from '@/lib/x';
import type {FeedItem} from '@/lib/model';

type Post={id:string;text:string;author_id:string;created_at?:string;attachments?:{media_keys?:string[]};public_metrics?:{like_count?:number;repost_count?:number;retweet_count?:number;reply_count?:number}};
type Media={media_key:string;type:string;preview_image_url?:string;url?:string;duration_ms?:number;variants?:Array<{url?:string;bit_rate?:number}>;public_metrics?:{view_count?:number}};

export async function GET(req:Request){
  try{
    const raw=new URL(req.url).searchParams.get('q')||'(AI OR OpenAI OR Claude OR MCP OR Codex) -is:retweet';
    if(raw.length>420)throw new Error('查询条件过长');
    const q=/\bhas:videos\b/i.test(raw)?raw:`has:videos (${raw})`;
    const result=await cached('x:video:'+q,900000,async()=>{
      const token=await getXToken();
      const u=new URL('https://api.x.com/2/tweets/search/recent');
      u.search=new URLSearchParams({query:q,max_results:'30',sort_order:'relevancy',start_time:new Date(Date.now()-86400000).toISOString(),expansions:'author_id,attachments.media_keys','tweet.fields':'created_at,public_metrics,attachments','media.fields':'type,url,preview_image_url,duration_ms,variants,public_metrics','user.fields':'username,name'}).toString();
      const r=await fetch(u,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
      if(!r.ok)throw new Error(r.status===402?'X 接口余额不足，请检查开发者控制台':r.status===429?'X 查询频率受限，请稍后再试':`X 视频查询失败（${r.status}），请检查授权与接口权限`);
      const data=await r.json() as {data?:Post[];includes?:{users?:Array<{id:string;username:string}>;media?:Media[]}};
      const media=new Map((data.includes?.media||[]).map(m=>[m.media_key,m]));
      const items:FeedItem[]=(data.data||[]).map(x=>{
        const user=data.includes?.users?.find(u=>u.id===x.author_id);
        const m=(x.attachments?.media_keys||[]).map(k=>media.get(k)).find(v=>v?.type==='video');
        const variant=m?.variants?.slice().sort((a,b)=>(b.bit_rate||0)-(a.bit_rate||0))[0];
        return {id:x.id,title:x.text.slice(0,150),summary:x.text,source:'@'+(user?.username||x.author_id),url:'https://x.com/'+(user?.username||'i')+'/status/'+x.id,time:x.created_at||null,metrics:{likes:x.public_metrics?.like_count||0,reposts:x.public_metrics?.repost_count||x.public_metrics?.retweet_count||0,replies:x.public_metrics?.reply_count||0,views:m?.public_metrics?.view_count||0},media:m?{type:'video' as const,previewUrl:m.preview_image_url,url:variant?.url||m.url,durationMs:m.duration_ms}:undefined,type:'x' as const};
      }).filter(x=>x.media);
      items.sort((a,b)=>((b.metrics?.likes||0)+(b.metrics?.reposts||0)+(b.metrics?.replies||0))-((a.metrics?.likes||0)+(a.metrics?.reposts||0)+(a.metrics?.replies||0)));
      return {value:{items,fetchedAt:new Date().toISOString(),query:q}};
    });
    return json({...result.value,stale:result.stale||false,cached:result.cached});
  }catch(e){return failure(e);}
}
