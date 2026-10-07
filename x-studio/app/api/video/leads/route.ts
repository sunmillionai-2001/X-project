import {body,db,failure,guardWrite,json} from '@/lib/server';
import {videoLeadSchema,type VideoLead} from '@/lib/model';

function rowToLead(row:{id:string;payload:string;revision:number;updated_at:string}):VideoLead{
  return {...videoLeadSchema.parse(JSON.parse(row.payload)),id:row.id,revision:row.revision,updatedAt:row.updated_at};
}

export async function GET(){
  try{
    const rows=await db().prepare("SELECT * FROM records WHERE kind='video_lead' ORDER BY updated_at DESC LIMIT 100").all<{id:string;payload:string;revision:number;updated_at:string}>();
    return json({leads:rows.results.map(rowToLead)});
  }catch(e){return failure(e);}
}

export async function POST(req:Request){
  try{
    guardWrite(req);
    const input=await body(req);
    const parsed=videoLeadSchema.parse(input.lead);
    const id=typeof input.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(input.id)?input.id:crypto.randomUUID();
    const revision=Number.isInteger(input.revision)&&input.revision>=0?input.revision:0;
    const old=await db().prepare("SELECT * FROM records WHERE id=?").bind(id).first<{revision:number;kind:string}>();
    if(old&&old.kind!=='video_lead')throw new Error('记录类型无效');
    if(!old&&revision!==0)return json({error:'视频线索版本已变化，请重新载入'},409);
    const now=new Date().toISOString();
    const result=await db().prepare("INSERT INTO records(id,kind,payload,revision,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=records.revision+1,updated_at=excluded.updated_at WHERE records.revision=?").bind(id,'video_lead',JSON.stringify(parsed),1,now,revision).run();
    if(!result.meta.changes)return json({error:'视频线索已在其他窗口修改，请重新载入'},409);
    return json({...parsed,id,revision:revision+1,updatedAt:now});
  }catch(e){return failure(e);}
}
