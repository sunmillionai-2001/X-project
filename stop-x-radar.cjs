const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
try {
  const info = JSON.parse(fs.readFileSync(path.join(__dirname, '.x-radar/server.json'), 'utf8'));
  if (!Number.isInteger(info.pid) || info.pid < 1) throw Error('记录的 PID 无效');
  const code = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); Get-CimInstance Win32_Process -Filter "ProcessId = ${info.pid}" | Select-Object -ExpandProperty CommandLine`;
  const command = execFileSync('powershell.exe', ['-NoProfile', '-Command', code], { encoding: 'utf8', windowsHide: true }).trim();
  const expected = path.join(__dirname, 'x-radar/server.mjs');
  if (!command) { console.log('服务已停止。'); process.exit(0); }
  if (!command.replace(/\\/g, '/').includes(expected.replace(/\\/g, '/'))) throw Error('该 PID 已不属于 X 雷达，不会停止其他程序');
  process.kill(info.pid); console.log('X 私人选题雷达已停止。');
} catch (e) { console.error(e.message); process.exitCode = 1; }
