import fs from 'node:fs/promises';

const dir = new URL('./low-follower-20261006/', import.meta.url);
const discovery = JSON.parse(await fs.readFile(new URL('discovery.json', dir), 'utf8'));
const ids = ['2094719194302706136', '2106216781174251724', '2097126909327106431', '2097298689869950999', '2098969056967786973', '2103444180861178199', '2106391117155770427'];
const calls = [];
async function get(url, label) {
  const at = new Date().toISOString();
  const r = await fetch(url, { signal: AbortSignal.timeout(18000), headers: { 'User-Agent': 'Private-X-Radar-Research/1.0' } });
  calls.push({ at, url, status: r.status, label });
  if (r.status === 429) throw Error('Public service rate limited; stop.');
  if (!r.ok) return null;
  const data = await r.json();
  await fs.writeFile(new URL(`verify-${calls.length}.json`, dir), JSON.stringify({ at, url, data }, null, 2) + '\n', 'utf8');
  return { at, data };
}
const studies = [];
for (const id of ids) {
  const initial = discovery.candidates.find(t => t.id === id);
  const detail = await get(`https://api.fxtwitter.com/status/${id}`, `detail-${id}`);
  const t = detail?.data.tweet ?? detail?.data.status;
  if (!t) { console.log(JSON.stringify({ id, failed: true })); continue; }
  const time = t.created_timestamp * 1000, since = new Date(time - 7 * 86400000).toISOString().slice(0, 10), until = new Date(time + 8 * 86400000).toISOString().slice(0, 10);
  const q = `from:${t.author.screen_name} since:${since} until:${until} -filter:retweets -filter:replies`;
  const ordinary = new Map(); let cursor = '';
  for (let page = 1; page <= 2; page++) {
    const u = new URL('https://api.fxtwitter.com/2/search');
    u.search = new URLSearchParams({ q, feed: 'latest', count: '50', ...(cursor ? { cursor } : {}) });
    const found = await get(u.href, `comparison-${id}-${page}`);
    const rows = found?.data.results || []; let fresh = 0;
    for (const p of rows) if (!ordinary.has(p.id) && p.author?.screen_name?.toLowerCase() === t.author.screen_name.toLowerCase() && !p.replying_to && !p.reposted_by && p.id !== id) { ordinary.set(p.id, p); fresh++; }
    const next = found?.data.cursor?.bottom;
    if (!rows.length || !fresh || !next || next === cursor) break;
    cursor = next;
  }
  const vs = [...ordinary.values()].filter(p => Number.isFinite(p.views) && p.views >= 0).sort((a, b) => a.views - b.views);
  const median = vs.length ? (vs[Math.floor((vs.length - 1) / 2)].views + vs[Math.floor(vs.length / 2)].views) / 2 : null;
  const comparison = vs.length ? vs.slice(Math.max(0, Math.floor(vs.length / 2) - 1), Math.floor(vs.length / 2) + 2) : [];
  studies.push({ checkedAt: detail.at, discoveryFollowers: initial.author.followers, post: t, baseline: { query: q, requestedSince: since, requestedUntil: until, sampleCount: ordinary.size, viewsKnown: vs.length, medianViews: median, relativeViews: median > 0 ? t.views / median : null, comparison }, neighboringPosts: [...ordinary.values()] });
  console.log(JSON.stringify({ id, handle: t.author.screen_name, followers: t.author.followers, views: t.views, bookmarks: t.bookmarks, chars: t.text?.length, articleKeys: Object.keys(t.article || {}), articleChars: JSON.stringify(t.article || {}).length, comparisonCount: ordinary.size, medianViews: median, relativeViews: median > 0 ? +(t.views / median).toFixed(2) : null }));
}
await fs.writeFile(new URL('verified.json', dir), JSON.stringify({ checkedAt: new Date().toISOString(), calls, studies }, null, 2) + '\n', 'utf8');
