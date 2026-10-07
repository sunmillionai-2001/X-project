const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'x-studio');
const runtimeDir=path.join(__dirname,'.workbench-local');
const address='http://127.0.0.1:5173';
function openBrowser(){if(process.argv.includes('--open'))spawn('cmd.exe',['/d','/s','/c','start "" "http://127.0.0.1:5173/"'],{windowsHide:true,stdio:'ignore'}).unref();}
async function health(){
 try{
  const response=await fetch(address+'/api/workspace',{signal:AbortSignal.timeout(2000)});
  if(!response.ok)return false;
  const data=await response.json();
  return Array.isArray(data.drafts)&&Array.isArray(data.settings?.businesses);
 }catch{return false;}
}
(async()=>{
 if(await health()){console.log('X Studio is ready: '+address);openBrowser();return;}
 if(!fs.existsSync(path.join(root,'dist/server/wrangler.json')))throw new Error('The built workbench is missing. Open the project in Codex to rebuild it.');
 fs.mkdirSync(runtimeDir,{recursive:true});
 const out=fs.openSync(path.join(runtimeDir,'server.log'),'a');
 const err=fs.openSync(path.join(runtimeDir,'server-error.log'),'a');
 const child=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','5173','--inspector-port','0'],{cwd:root,windowsHide:true,stdio:['ignore',out,err]});
 child.on('error',error=>{console.error(error.message);process.exitCode=1;});
 fs.closeSync(out);fs.closeSync(err);
 fs.writeFileSync(path.join(runtimeDir,'server.json'),JSON.stringify({pid:child.pid,address,startedAt:new Date().toISOString()},null,2),'utf8');
 for(let n=0;n<30;n++){await new Promise(r=>setTimeout(r,1000));if(await health()){console.log('X Studio is ready: '+address);console.log('Keep this launcher window open while using the local workbench.');openBrowser();return;}}
 throw new Error('X Studio did not become ready. Check .workbench-local/server-error.log.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
