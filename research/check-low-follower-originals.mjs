import fs from 'node:fs/promises';
import { anonymousXProfile } from '../x-radar/x-public-network.mjs';
const dir = new URL('./low-follower-20261006/', import.meta.url);
const report = [];
const remote = async (url, options, max) => {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(options.timeout) });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  const body = Buffer.from(await r.arrayBuffer()); if (body.length > max) throw Error('Response too large');
  return { body };
};
for (const handle of ['nian_tu41685', 'lieflat_3', 'justhalfbit', 'longhaiqwe123', 'criscxuan', 'AI_DVD6', 'Minsi_AI']) {
  const at = new Date().toISOString();
  try {
    const html = await anonymousXProfile(handle, remote);
    await fs.writeFile(new URL(`x-${handle}.html`, dir), html, 'utf8');
    const followers = [...html.matchAll(/followers_count[":]*\s*:?\s*(\d+)/g)].map(m => Number(m[1]));
    const text = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const verified = { handle, at, received: true, bytes: Buffer.byteLength(html), title: text, followerCounts: [...new Set(followers)], containsHandle: html.includes(handle) };
    report.push(verified); console.log(JSON.stringify(verified));
  } catch (e) { const failed = { handle, at, received: false, reason: e.message }; report.push(failed); console.log(JSON.stringify(failed)); }
}
await fs.writeFile(new URL('original-page-check.json', dir), JSON.stringify({ usesUserSession: false, requiresUserLogin: false, pages: report }, null, 2) + '\n', 'utf8');
