import fs from 'node:fs/promises';

const dir = new URL('./low-follower-20261006/', import.meta.url);
await fs.mkdir(dir, { recursive: true });
const queries = [
  '(AI OR Claude OR ChatGPT OR Codex) lang:zh min_faves:100 -filter:retweets -filter:replies since:2026-09-15',
  '(教程 OR 工作流 OR 提示词 OR Skill) (AI OR Claude OR Codex OR Gemini) lang:zh min_faves:80 -filter:retweets -filter:replies since:2026-09-01',
  '(AI OR Claude OR ChatGPT OR Codex) lang:zh min_faves:200 -filter:retweets -filter:replies since:2026-08-01 until:2026-09-15'
];
const calls = [], found = new Map();
let stopped = false;
async function request(url, label) {
  if (stopped) return null;
  const at = new Date().toISOString(), r = await fetch(url, { signal: AbortSignal.timeout(18000), headers: { 'User-Agent': 'Private-X-Radar-Research/1.0' } });
  const call = { label, url, at, status: r.status }; calls.push(call);
  if (r.status === 429) { stopped = true; throw Error('Public service rate limited; stop requests.'); }
  if (!r.ok) return null;
  const data = await r.json();
  await fs.writeFile(new URL(`search-${calls.length}.json`, dir), JSON.stringify({ at, url, data }, null, 2) + '\n', 'utf8');
  return data;
}
for (const [n, q] of queries.entries()) {
  let cursor = '', seen = new Set();
  for (let page = 1; page <= 3; page++) {
    const u = new URL('https://api.fxtwitter.com/2/search');
    u.search = new URLSearchParams({ q, feed: 'top', count: '50', ...(cursor ? { cursor } : {}) });
    const data = await request(u.href, `query-${n + 1}-page-${page}`);
    if (!data?.results?.length) break;
    let fresh = 0;
    for (const t of data.results) {
      if (!found.has(t.id)) { found.set(t.id, t); fresh++; }
    }
    console.log(JSON.stringify({ query: n + 1, page, rows: data.results.length, fresh }));
    const next = data.cursor?.bottom;
    if (!next || seen.has(next) || !fresh) break;
    seen.add(next); cursor = next;
  }
}
const candidates = [...found.values()].filter(t => t.author?.followers > 0 && t.author.followers <= 10000 && !t.replying_to && !t.reposted_by && /AI|Claude|ChatGPT|Codex|Gemini|Skill/i.test(t.text || ''));
await fs.writeFile(new URL('discovery.json', dir), JSON.stringify({ checkedAt: new Date().toISOString(), queries, calls, uniquePosts: found.size, candidates }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ uniquePosts: found.size, candidates: candidates.length, posts: candidates.map(t => ({ id: t.id, handle: t.author.screen_name, name: t.author.name, followers: t.author.followers, likes: t.likes, bookmarks: t.bookmarks, views: t.views, date: t.created_at, chars: [...t.text].length, media: t.media?.all?.map(m => m.type), title: t.article?.title, text: t.text.slice(0, 420) })) }, null, 2));
