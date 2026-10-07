// Read-only feasibility probe. Node 24; no dependencies, keys, or browser cookies.
// Usage: node research/x-source-probe.mjs [--extra]
// Results stay in research; this does not update the production radar.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const checkedAt = new Date().toISOString();
const handles = ['ChatGPT', 'OpenAI', 'dotey', 'karpathy'];
const sampleIds = ['2106083595433791573', '2106635352609865925'];
const fx = 'https://api.fxtwitter.com';
const probes = handles.map(handle => ({
  name: `FxEmbed timeline @${handle}`, kind: 'timeline', handle,
  url: `${fx}/2/profile/${handle}/statuses?count=10`,
}));
for (const id of sampleIds) probes.push({
  name: `FxEmbed post ${id}`, kind: 'post', id, url: `${fx}/status/${id}`,
});
probes.push(
  { name: 'FxEmbed latest search', kind: 'search', url: `${fx}/2/search?q=from%3AOpenAI&feed=latest&count=5` },
  { name: 'FxEmbed RSS @ChatGPT', kind: 'rss', url: 'https://fxtwitter.com/ChatGPT/feed.xml?count=10' },
  { name: 'VxTwitter single post', kind: 'vx', id: sampleIds[0], url: `https://api.vxtwitter.com/Twitter/status/${sampleIds[0]}` },
);
if (process.argv.includes('--extra')) probes.push(
  { name: 'X public profile HTML', kind: 'html', url: 'https://x.com/dotey' },
  { name: 'Jina public profile reader', kind: 'html', url: 'https://r.jina.ai/https://x.com/dotey' },
  { name: 'Nitter tiekoetter RSS', kind: 'rss', url: 'https://nitter.tiekoetter.com/ChatGPT/rss' },
  { name: 'Nitter privacyredirect RSS', kind: 'rss', url: 'https://nitter.privacyredirect.com/ChatGPT/rss' },
  { name: 'XCancel RSS', kind: 'rss', url: 'https://xcancel.com/ChatGPT/rss' },
);

const numberOrNull = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
function normalizePost(post, provider, monitoredAccount) {
  if (!post || post.type === 'tombstone' || post.author?.protected) return null;
  const id = String(post.id ?? post.tweetID ?? '');
  const author = post.author?.screen_name ?? post.user_screen_name;
  const text = post.text;
  if (!/^\d{2,20}$/.test(id) || !/^[a-zA-Z0-9_]{1,15}$/.test(author ?? '') || typeof text !== 'string' || !text.trim()) return null;
  const timestamp = post.created_timestamp ?? post.date_epoch;
  const parsedTime = timestamp ? timestamp * 1000 : Date.parse(post.created_at ?? post.date);
  if (!Number.isFinite(parsedTime)) return null;
  const sourceUrl = `https://x.com/${author}/status/${id}`;
  const suppliedUrl = post.url ?? post.tweetURL;
  if (suppliedUrl && !new RegExp(`/status/${id}(?:[/?#]|$)`).test(suppliedUrl)) return null;
  const reply = typeof post.replying_to === 'object' ? post.replying_to?.status : post.replying_to_status ?? post.replyingToID;
  return {
    id, sourceUrl, author, monitoredAccount: monitoredAccount ?? null,
    authoredByMonitoredAccount: monitoredAccount ? author.toLowerCase() === monitoredAccount.toLowerCase() : null,
    publishedAt: new Date(parsedTime).toISOString(), fetchedAt: checkedAt,
    text, characters: [...text].length, textCompleteness: 'returned_body_not_independently_verified',
    replyToId: reply ?? null, repostedBy: post.reposted_by ?? null,
    isLongPost: post.is_note_tweet ?? null,
    metrics: {
      likes: numberOrNull(post.likes), replies: numberOrNull(post.replies),
      reposts: numberOrNull(post.reposts ?? post.retweets), quotes: numberOrNull(post.quotes),
      views: numberOrNull(post.views), bookmarks: numberOrNull(post.bookmarks),
    },
    media: post.media ?? post.media_extended ?? null,
    collector: provider,
  };
}

async function runProbe(probe) {
  const started = Date.now();
  const result = { ...probe, checkedAt, usesOfficialDeveloperAPI: false, requiresUserCredentials: false };
  try {
    const response = await fetch(probe.url, {
      signal: AbortSignal.timeout(18000),
      headers: { 'User-Agent': 'Private-X-Radar-Research/1.0' },
    });
    result.httpStatus = response.status;
    result.contentType = response.headers.get('content-type');
    result.cacheAge = response.headers.get('age');
    const body = await response.text();
    result.responseBytes = Buffer.byteLength(body, 'utf8');
    if (!response.ok) {
      result.outcome = 'http_error';
      result.error = body.slice(0,250);
    } else if (['timeline','search','post','vx'].includes(probe.kind)) {
      const data = JSON.parse(body);
      result.providerCode = data.code ?? null;
      const rows = probe.kind === 'post' ? [data.tweet ?? data.status] : probe.kind === 'vx' ? [data] : data.results;
      const posts = Array.isArray(rows) ? rows.map(post => normalizePost(post, probe.kind === 'vx' ? 'VxTwitter' : 'FxEmbed', probe.handle)).filter(Boolean) : [];
      const correctId = !probe.id || posts.some(post => post.id === probe.id);
      result.outcome = (data.code == null || data.code === 200) && correctId && posts.length ? 'posts_returned' : 'no_valid_posts';
      result.returnedCount = Array.isArray(rows) ? rows.length : 0;
      result.validCount = posts.length;
      result.ownAuthorCount = probe.handle ? posts.filter(post => post.authoredByMonitoredAccount).length : null;
      result.otherAuthorCount = probe.handle ? posts.filter(post => !post.authoredByMonitoredAccount).length : null;
      result.newestPublishedAt = posts.map(post => post.publishedAt).sort().at(-1) ?? null;
      result.cursorAvailable = Boolean(data.cursor?.bottom);
      result.posts = posts;
    } else if (probe.kind === 'rss') {
      const rssValid = /<rss[\s>]/i.test(body) && /<channel[\s>]/i.test(body);
      const items = [...body.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(match => match[0]);
      result.outcome = rssValid && items.length ? 'rss_returned' : 'no_valid_rss';
      result.itemCount = items.length;
      result.postLinks = items.map(item => item.match(/<link>\s*(https:\/\/(?:x|twitter)\.com\/[^<]+)\s*<\/link>/i)?.[1]).filter(Boolean);
      result.utf8Declared = /encoding=["']UTF-8["']/i.test(body);
    } else {
      // A reachable HTML page is not proof that a usable timeline was obtained.
      result.outcome = 'page_only_requires_content_inspection';
      result.title = body.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null;
      result.snippet = body.slice(0,200);
    }
  } catch (error) {
    result.outcome = 'request_failed';
    result.error = error.message;
    result.errorCode = error.cause?.code ?? null;
  }
  result.elapsedMs = Date.now() - started;
  return result;
}

const results = [];
// Two concurrent public requests at most; no retries or account rotation.
for (let start = 0; start < probes.length; start += 2) {
  const batch = await Promise.allSettled(probes.slice(start, start + 2).map(runProbe));
  for (const entry of batch) {
    if (entry.status !== 'fulfilled') throw entry.reason;
    results.push(entry.value);
    const { name, outcome, httpStatus, validCount, itemCount, errorCode } = entry.value;
    console.log(JSON.stringify({ name, outcome, httpStatus, validCount, itemCount, errorCode }));
  }
}
const fxPost = results.find(result => result.kind === 'post' && result.id === sampleIds[0])?.posts?.[0];
const vxPost = results.find(result => result.kind === 'vx')?.posts?.[0];
const longPost = results.find(result => result.kind === 'post' && result.id === sampleIds[1])?.posts?.[0];
const timelineLongPost = results.find(result => result.handle === 'dotey')?.posts?.find(post => post.id === sampleIds[1]);
const report = {
  checkedAt, purpose: 'nonofficial_public_X_read_only_feasibility',
  productionRadarUpdated: false, usesOfficialDeveloperAPI: false, modelCalls: 0,
  limitations: [
    'Public services are third-party dependencies; self-hosting has not been tested.',
    'One timeline page does not prove complete or realtime account coverage.',
    'Timeline results include replies, threads and other authors; preserve attribution and filter deliberately.',
    'Engagement values are provider observations, not guaranteed current official counts.',
  ],
  comparisons: {
    sameSinglePostIdAcrossProviders: fxPost && vxPost ? fxPost.id === vxPost.id : null,
    exactTextMatchAcrossProviders: fxPost && vxPost ? fxPost.text === vxPost.text : null,
    vxOmittedFinancesUrl: fxPost && vxPost ? fxPost.text.includes('chatgpt.com/finances') && !vxPost.text.includes('chatgpt.com/finances') : null,
    chineseLongPostCharacters: longPost?.characters ?? null,
    chinesePostMatchesTimelineText: longPost && timelineLongPost ? longPost.text === timelineLongPost.text : null,
  },
  results,
};
const output = new URL('./x-source-probe-results.json', import.meta.url);
await mkdir(new URL('./', output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: fileURLToPath(output), comparisons: report.comparisons }));
