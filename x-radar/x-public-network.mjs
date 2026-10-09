import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { xHandle, xImageURL } from './x-source.mjs';

const run = promisify(execFile);
const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
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
  try { output = await run(curl, args, { windowsHide: true, timeout: 19000, maxBuffer: 3100000, encoding: 'utf8' }); }
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
  try { output = await run(curl, args, { windowsHide: true, timeout: 15000, maxBuffer: 3100000, encoding: 'buffer' }); }
  catch { throw new Error('公开图片暂时无法读取'); }
  const marker = output.stdout.lastIndexOf(Buffer.from('\nXRADAR_HTTP:'));
  if (marker < 0 || output.stdout.subarray(marker).toString('ascii') !== '\nXRADAR_HTTP:200') throw new Error('公开图片服务未返回可用图片');
  return output.stdout.subarray(0, marker);
}

export async function anonymousXJSON(value, remote) {
  const u = new URL(value);
  if (u.origin !== 'https://api.fxtwitter.com' || u.username || u.password || u.hash ||
    !/^\/(?:status\/\d{2,20}|2\/(?:search|(?:thread|conversation)\/\d{2,20}|profile\/[A-Za-z0-9_]{1,15}\/statuses))$/.test(u.pathname)) throw new Error('公开接口地址无效');
  const proxy = await systemProxy();
  const headers = { 'User-Agent': 'PrivateXRadar-Public/1.0', Accept: 'application/json' };
  if (!proxy) return remote(u.href, { timeout: 16000, headers }, 3000000);
  // Use the configured local network proxy, never a browser profile or X session.
  // No redirects or curl configuration files; only the fixed public API host is allowed.
  const args = ['-q', '--proxy', proxy, '--noproxy', '', '--proto', '=https', '--connect-timeout', '6',
    '--max-time', '16', '--compressed', '--silent', '--show-error', '--max-filesize', '3000000',
    '--user-agent', headers['User-Agent'], '--header', 'Accept: application/json', '--include', '--suppress-connect-headers', u.href];
  let output;
  try { output = await run(curl, args, { windowsHide: true, timeout: 19000, maxBuffer: 3100000, encoding: 'utf8' }); }
  catch { throw new Error('公开接口暂时无法连接，已保留采集进度'); }
  const split = output.stdout.indexOf('\r\n\r\n');
  const head = output.stdout.slice(0, split); const status = Number(head.match(/^HTTP\/\S+\s+(\d+)/)?.[1]);
  if (split < 0 || !status) throw new Error('公开接口返回格式异常');
  const responseHeaders = new Headers();
  for (const line of head.split('\r\n').slice(1)) { const colon = line.indexOf(':'); if (colon > 0) responseHeaders.append(line.slice(0, colon), line.slice(colon + 1).trim()); }
  if (status !== 200) {
    const e = new Error('公开来源返回 ' + status);
    if (status === 429) { const retry = responseHeaders.get('retry-after'); const delay = /^\d+$/.test(retry || '') ? Number(retry) * 1000 : Date.parse(retry || '') - Date.now(); e.rateLimited = true; e.retryAt = new Date(Date.now() + Math.max(60000, Number.isFinite(delay) ? delay : 900000)).toISOString(); }
    throw e;
  }
  return { status, headers: responseHeaders, body: Buffer.from(output.stdout.slice(split + 4), 'utf8'), url: u.href };
}
