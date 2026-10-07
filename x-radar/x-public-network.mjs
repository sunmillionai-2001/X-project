import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { xHandle, xImageURL } from './x-source.mjs';

const run = promisify(execFile);
let proxyCheckedAt = 0, savedProxy = '', proxyPending = null;
function localProxy(value) {
  const u = new URL(value.startsWith('http') ? value : 'http://' + value);
  if (!['http:', 'https:'].includes(u.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) || u.username || u.password || !u.port || u.pathname !== '/' || u.search || u.hash) throw new Error('公开页面代理仅支持本机无凭据 HTTP/HTTPS 代理');
  return u.origin;
}
async function systemProxy() {
  if (process.env.XRADAR_PUBLIC_PROXY === 'off') return '';
  if (process.env.XRADAR_PUBLIC_PROXY) return localProxy(process.env.XRADAR_PUBLIC_PROXY);
  if (process.platform !== 'win32') return '';
  if (proxyPending) return proxyPending;
  if (Date.now() - proxyCheckedAt < 60000) return savedProxy;
  proxyPending = (async () => {
    savedProxy = '';
    try {
      const base = ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'];
      const enabled = await run('reg.exe', [...base, '/v', 'ProxyEnable'], { windowsHide: true, timeout: 2000, encoding: 'utf8' });
      if (!/REG_DWORD\s+0x1\b/.test(enabled.stdout)) return '';
      const setting = await run('reg.exe', [...base, '/v', 'ProxyServer'], { windowsHide: true, timeout: 2000, encoding: 'utf8' });
      const server = setting.stdout.match(/REG_SZ\s+([^\r\n]+)/)?.[1]?.trim();
      if (server) savedProxy = localProxy(server.includes('=') ? server.match(/(?:^|;)https=([^;]+)/)?.[1] || '' : server);
    } catch { /* Unsupported proxy configuration: try the ordinary anonymous HTTPS request. */ }
    finally { proxyCheckedAt = Date.now(); }
    return savedProxy;
  })();
  try { return await proxyPending; } finally { proxyPending = null; }
}

export async function anonymousXProfile(handle, remote) {
  const url = `https://x.com/${xHandle(handle)}`;
  const proxy = await systemProxy();
  if (!proxy) {
    const r = await remote(url, { timeout: 16000, headers: { 'User-Agent': 'PrivateXRadar-Public/1.0' } }, 3000000);
    return r.body.toString('utf8');
  }
  // -q disables curl configuration files. No Cookie, token, browser profile or downloaded JS is used.
  const args = ['-q', '--proxy', proxy, '--noproxy', '', '--proto', '=https', '--proto-redir', '=https',
    '--connect-timeout', '6', '--max-time', '16', '--location', '--max-redirs', '2', '--compressed',
    '--silent', '--show-error', '--max-filesize', '3000000', '--user-agent', 'PrivateXRadar-Public/1.0',
    '--write-out', '\nXRADAR_HTTP:%{http_code}', url];
  let output;
  try { output = await run('curl.exe', args, { windowsHide: true, timeout: 19000, maxBuffer: 3100000, encoding: 'utf8' }); }
  catch (e) { throw new Error(`匿名主页读取失败（${typeof e.code === 'number' ? 'curl ' + e.code : '网络不可用'}）；近期帖子仍可单独采集`); }
  const status = Number(output.stdout.match(/\nXRADAR_HTTP:(\d+)$/)?.[1]);
  if (status !== 200) throw new Error(`匿名主页返回 ${status || '未知状态'}，未确认当前置顶`);
  return output.stdout.replace(/\nXRADAR_HTTP:\d+$/, '');
}

export async function publicXImage(value, remote) {
  const url = xImageURL(value); if (!url) throw new Error('仅支持 X 公开图片域名');
  const proxy = await systemProxy();
  if (!proxy) return (await remote(url, { timeout: 12000 }, 3000000)).body;
  const args = ['-q', '--proxy', proxy, '--noproxy', '', '--proto', '=https', '--connect-timeout', '5', '--max-time', '12',
    '--silent', '--show-error', '--max-filesize', '3000000', '--user-agent', 'PrivateXRadar-Public/1.0',
    '--write-out', '\nXRADAR_HTTP:%{http_code}', url];
  let output;
  try { output = await run('curl.exe', args, { windowsHide: true, timeout: 15000, maxBuffer: 3100000, encoding: 'buffer' }); }
  catch { throw new Error('公开图片暂时无法读取'); }
  const marker = output.stdout.lastIndexOf(Buffer.from('\nXRADAR_HTTP:'));
  if (marker < 0 || output.stdout.subarray(marker).toString('ascii') !== '\nXRADAR_HTTP:200') throw new Error('公开图片服务未返回可用图片');
  return output.stdout.subarray(0, marker);
}
