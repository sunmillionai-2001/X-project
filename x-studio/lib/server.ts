import { env } from 'cloudflare:workers';
export const runtime=env as Cloudflare.Env & {X_CLIENT_ID?:string;X_CLIENT_SECRET?:string;X_BEARER_TOKEN?:string;X_TOKEN_SECRET?:string;APP_ORIGIN?:string};
export function db(){if(!runtime.DB)throw new Error('数据存储暂不可用，请稍后重试');return runtime.DB;}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});}
export function guardWrite(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)throw new Error('请求来源无效');}
export async function body(req:Request){const text=await req.text();if(text.length>80000)throw new Error('内容过长');return JSON.parse(text);}
export function failure(e:unknown){const message=e instanceof Error?e.message:'操作失败';return json({error:message.includes('SQLITE')?'数据存储暂不可用，请重试':message},400);}
export async function readRecord(id:string){return db().prepare('SELECT * FROM records WHERE id = ?').bind(id).first<{id:string;kind:string;payload:string;revision:number;updated_at:string}>();}
export async function cached<T>(key:string,ttl:number,fetcher:(etag?:string)=>Promise<{value:T;etag?:string;notModified?:boolean}>):Promise<{value:T;cached:boolean;stale?:boolean;fetchedAt?:string}>{
 const old=await db().prepare('SELECT * FROM cache WHERE id = ?').bind(key).first<{payload:string;expires_at:number;etag:string}>();
 if(old&&old.expires_at>Date.now())return {value:JSON.parse(old.payload),cached:true};
 try{const next=await fetcher(old?.etag);const value=next.notModified&&old?JSON.parse(old.payload):next.value;await db().prepare('INSERT INTO cache(id,payload,expires_at,etag) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at,etag=excluded.etag').bind(key,JSON.stringify(value),Date.now()+ttl,next.etag||old?.etag||null).run();return {value,cached:false};}
 catch(e){if(old)return {value:JSON.parse(old.payload),cached:true,stale:true};throw e;}
}
export async function fetchJson(url:string,headers:Record<string,string>={}){const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(response.status===429?'接口访问频率受限，请稍后再试':`数据源暂不可用（${response.status}）`);return response.json();}
