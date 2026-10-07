import fs from 'node:fs/promises';
import { anonymousXProfile, publicXImage } from '../x-radar/x-public-network.mjs';
const handle = 'JosimeNasi13175';
const dir = new URL('./xiexiaojiu-20261007/', import.meta.url);
await fs.mkdir(dir, { recursive: true });
const phase = process.argv[2] || 'initial';
const calls = [];
async function get(url, label) {
  const at = new Date().toISOString();
  const r = await fetch(url, { signal: AbortSignal.timeout(18000), headers: { 'User-Agent': 'Private-X-Radar-Research/1.0' } });
  const info = { at, url, status: r.status, label }; calls.push(info);
  if (r.status === 429) throw Error('Public service rate limited; stop.');
  if (!r.ok) return null;
  const data = await r.json();
  await fs.writeFile(new URL(label + '.json', dir), JSON.stringify({ ...info, data }, null, 2) + '\n', 'utf8');
  return data;
}
async function search(q, feed, pages, label) {
  const posts = new Map(); let cursor = '', exhausted = false;
  for (let n = 1; n <= pages; n++) {
    const u = new URL('https://api.fxtwitter.com/2/search');
    u.search = new URLSearchParams({ q, feed, count: '50', ...(cursor ? { cursor } : {}) });
    const data = await get(u.href, `${label}-${n}`);
    const rows = data?.results || []; let fresh = 0;
    for (const t of rows) if (!posts.has(t.id)) { posts.set(t.id, t); fresh++; }
    console.log(JSON.stringify({ label, page: n, count: rows.length, fresh, oldest: rows.at(-1)?.created_at }));
    const next = data?.cursor?.bottom;
    if (!rows.length || !fresh || !next || next === cursor) { exhausted = true; break; }
    cursor = next;
  }
  return { query: q, feed, maxPages: pages, exhausted, posts: [...posts.values()] };
}
if (phase === 'initial') {
  const remote = async (url, options, max) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(options.timeout), headers: options.headers });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const body = Buffer.from(await r.arrayBuffer()); if (body.length > max) throw Error('Response too large');
    return { body };
  };
  const results = await Promise.allSettled([
    (async () => { const html = await anonymousXProfile(handle, remote); await fs.writeFile(new URL('original-profile.html', dir), html, 'utf8'); return { profileBytes: html.length, title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] }; })(),
    search(`from:${handle} -filter:retweets -filter:replies since:2026-09-01`, 'latest', 1, 'initial-roots')
  ]);
  for (const r of results) if (r.status === 'fulfilled') {
    if (r.value.posts) {
      await fs.writeFile(new URL('initial.json', dir), JSON.stringify(r.value, null, 2) + '\n', 'utf8');
      console.log(JSON.stringify(r.value.posts.slice(0, 8).map(t => ({ id: t.id, author: t.author, text: t.text, views: t.views, date: t.created_at })), null, 2));
    } else console.log(JSON.stringify(r.value));
  } else console.log(JSON.stringify({ error: r.reason.message }));
}
if (phase === 'collect') {
  const results = [];
  for (const [q, feed, pages, label] of [
    [`from:${handle} -filter:retweets -filter:replies since:2026-08-01 until:2026-10-08`, 'latest', 6, 'roots'],
    [`from:${handle} (起号 OR 粉丝 OR 涨粉 OR 蓝V OR 蓝v OR 收益 OR 复盘 OR 互关 OR 关注 OR 互动) since:2026-08-01 until:2026-10-08`, 'top', 3, 'growth'],
    [`from:${handle} filter:replies since:2026-10-01 until:2026-10-08`, 'latest', 2, 'replies'],
    [`from:${handle} -filter:retweets -filter:replies since:2026-08-01 until:2026-10-08`, 'top', 2, 'top']
  ]) results.push({ label, ...(await search(q, feed, pages, label)) });
  await fs.writeFile(new URL('collection.json', dir), JSON.stringify({ handle, checkedAt: new Date().toISOString(), usesUserSession: false, officialDeveloperAPI: false, calls, searches: results }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(results.map(s => ({ label: s.label, posts: s.posts.length, exhausted: s.exhausted }))));
}
if (phase === 'earlier') {
  const searches = [];
  for (const [q, feed, pages, label] of [
    [`from:${handle} -filter:retweets -filter:replies since:2026-09-01 until:2026-10-03`, 'latest', 12, 'earlier-roots'],
    [`from:${handle} filter:replies since:2026-10-05 until:2026-10-06`, 'latest', 3, 'oct5-replies'],
    [`from:${handle} (粉丝 OR 涨粉 OR 开通 OR 新人 OR 互关) since:2026-09-01 until:2026-09-29`, 'latest', 3, 'early-growth']
  ]) searches.push({ label, ...(await search(q, feed, pages, label)) });
  await fs.writeFile(new URL('earlier.json', dir), JSON.stringify({ handle, checkedAt: new Date().toISOString(), calls, searches }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(searches.map(s => ({ label: s.label, posts: s.posts.length, exhausted: s.exhausted }))));
}
if (phase === 'verify') {
  const ids = ['2104578404754587847', '2105479862106612095', '2105913723802284195', '2106945513044247021', '2107386131629359228', '2104222172747321765', '2105511452937527495', '2107366030700110245', '2105453936731902155'];
  const posts = [];
  for (const id of ids) {
    const data = await get(`https://api.fxtwitter.com/status/${id}`, `detail-${id}`);
    const t = data?.tweet ?? data?.status;
    if (!t) continue;
    posts.push(t);
    console.log(JSON.stringify({ id, date: t.created_at, text: t.text, views: t.views, likes: t.likes, bookmarks: t.bookmarks, replies: t.replies, media: t.media?.all?.map(m => ({type:m.type,url:m.url,thumbnail:m.thumbnail_url})) }));
  }
  const early = await search(`from:${handle} -filter:retweets -filter:replies since:2026-09-01 until:2026-09-22`, 'latest', 2, 'first-period');
  await fs.writeFile(new URL('verified.json', dir), JSON.stringify({ checkedAt: new Date().toISOString(), calls, posts, early }, null, 2) + '\n', 'utf8');
  const remote = async (url, options, max) => { const r = await fetch(url,{signal:AbortSignal.timeout(options.timeout)}); if(!r.ok)throw Error(`HTTP ${r.status}`); const body=Buffer.from(await r.arrayBuffer());if(body.length>max)throw Error('Response too large');return {body}; };
  for (const id of ['2105479862106612095', '2105913723802284195', '2105511452937527495']) {
    const t=posts.find(t=>t.id===id);
    for (let n=0;n<Math.min(2,t?.media?.photos?.length||0);n++) {
      const url=t.media.photos[n].url;
      try {const bytes=await publicXImage(url,remote);await fs.writeFile(new URL(`media-${id}-${n}.jpg`,dir),bytes);console.log(JSON.stringify({image:`media-${id}-${n}.jpg`,bytes:bytes.length}));}catch(e){console.log(JSON.stringify({imageFailed:id,error:e.message}));}
    }
  }
}
