const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const address='http://127.0.0.1:8766/';
const python=process.env.WORKBENCH_PYTHON||path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');
async function health(){try{const r=await fetch(address+'api/health',{signal:AbortSignal.timeout(2000)});return r.ok&&(await r.json()).service==='creator-workbench-v2';}catch{return false;}}
function open(){if(process.argv.includes('--open'))spawn('cmd.exe',['/d','/s','/c','start "" "http://127.0.0.1:8766/"'],{windowsHide:true,stdio:'ignore'}).unref();}
(async()=>{
 if(await health()){console.log('AI Studio 2.0: '+address);open();return;}
 if(!fs.existsSync(python))throw Error('Python not found. Set WORKBENCH_PYTHON to your Python executable.');
 const runtime=path.join(__dirname,'.workbench-v2');fs.mkdirSync(runtime,{recursive:true});
 const out=fs.openSync(path.join(runtime,'server.log'),'a');
 const child=spawn(python,[path.join(__dirname,'x-studio/local/server.py')],{cwd:__dirname,env:{...process.env,PYTHONIOENCODING:'utf-8'},windowsHide:true,stdio:['ignore',out,out]});fs.closeSync(out);
 child.on('error',e=>console.error(e));
 fs.writeFileSync(path.join(runtime,'server.json'),JSON.stringify({pid:child.pid,address,startedAt:new Date().toISOString()},null,2),'utf8');
 for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,500));if(await health()){console.log('AI Studio 2.0: '+address);console.log('Keep this window open.');open();return;}}
 throw Error('Server did not start. See .workbench-v2/server.log.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
