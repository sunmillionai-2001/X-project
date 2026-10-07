import {cached,failure,json,fetchJson} from '@/lib/server';
import {getXToken} from '@/lib/x';
export async function GET(){try{const r=await cached('x:trends:world',900000,async()=>({value:await fetchJson('https://api.x.com/2/trends/by/woeid/1',{Authorization:'Bearer '+await getXToken()})}));return json({trends:r.value,stale:r.stale||false});}catch(e){return failure(e);}}
