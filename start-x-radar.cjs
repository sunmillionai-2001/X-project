const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const address = 'http://127.0.0.1:8770/';
async function health() { try { const r = await fetch(address + 'api/health', { signal: AbortSignal.timeout(1500) }); return r.ok && (await r.json()).service === 'private-x-radar'; } catch { return false; } }
function open() { if (process.argv.includes('--open')) spawn('cmd.exe', ['/d', '/s', '/c', 'start "" "http://127.0.0.1:8770/"'], { windowsHide: true, stdio: 'ignore' }).unref(); }
(async () => {
  if (await health()) { console.log('X 私人选题雷达：' + address); open(); return; }
  const data = path.join(__dirname, '.x-radar'); fs.mkdirSync(data, { recursive: true });
  const log = fs.openSync(path.join(data, 'server.log'), 'a');
  const child = spawn(process.execPath, [path.join(__dirname, 'x-radar/server.mjs')], { cwd: __dirname, windowsHide: true, stdio: ['ignore', log, log], detached: true }); fs.closeSync(log); child.unref();
  child.on('error', e => console.error(e.message));
  fs.writeFileSync(path.join(data, 'server.json'), JSON.stringify({ pid: child.pid, address, startedAt: new Date().toISOString() }), 'utf8');
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 500)); if (await health()) { console.log('X 私人选题雷达：' + address); open(); return; } }
  throw Error('服务没有启动，请检查 .x-radar/server.log');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
