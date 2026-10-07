import { hash, requireValue } from './core.mjs';

export const X_DEFAULT_ACCOUNTS = [
  { handle: 'AI_Jasonyu', name: '鱼总聊AI', enabled: true },
  { handle: 'dotey', name: '宝玉', enabled: true },
  { handle: 'OpenAI', name: 'OpenAI', enabled: true },
  { handle: 'ChatGPT', name: 'ChatGPT', enabled: true },
];
export const X_HISTORY_DAYS = 12;
export const X_ACCOUNT_LIMIT = 20;
export const X_PROVIDER = 'FxEmbed 公开服务';
const DAY = 86400000;
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

export function xHandle(input) {
  let value = String(input ?? '').trim();
  if (/^https?:\/\//i.test(value)) {
    const u = new URL(value);
    requireValue(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(u.hostname) && !u.username && !u.password, '请填写 X 用户名或主页链接');
    requireValue(/^\/[^/]+\/?$/.test(u.pathname), '请填写账号主页链接，不是帖子链接');
    value = u.pathname.split('/')[1];
  }
  value = value.replace(/^@/, '');
  requireValue(/^[A-Za-z0-9_]{1,15}$/.test(value) && !['home', 'i', 'explore', 'search', 'settings', 'intent'].includes(value.toLowerCase()), '请输入 @用户名，例如 @AI_Jasonyu；中文昵称不能作为采集地址');
  return value;
}

export function xAccounts(input) {
  requireValue(Array.isArray(input) && input.length <= X_ACCOUNT_LIMIT, `最多观察 ${X_ACCOUNT_LIMIT} 个账号`);
  const seen = new Set();
  return input.map(a => {
    const handle = xHandle(a.handle);
    requireValue(!seen.has(handle.toLowerCase()), '观察账号重复'); seen.add(handle.toLowerCase());
    return { handle, name: String(a.name || handle).slice(0, 80), enabled: a.enabled !== false };
  });
}

export function xImageURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && ['pbs.twimg.com', 'abs.twimg.com'].includes(u.hostname) && !u.username && !u.password && !u.port ? u.href : ''; } catch { return ''; }
}
const count = v => v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
function articleData(a) {
  if (!a || !/^\d{2,20}$/.test(String(a.id || ''))) return null;
  const blocks = Array.isArray(a.content?.blocks) ? a.content.blocks : [];
  const body = blocks.map(b => typeof b.text === 'string' ? b.text : '').filter(Boolean).join('\n\n').slice(0, 120000);
  return { id: String(a.id), title: String(a.title || '').slice(0, 500), preview: String(a.preview_text || '').slice(0, 8000), body, contentStatus: body ? 'body_received' : 'preview_only', cover: xImageURL(a.cover_media?.media_info?.original_img_url), url: `https://x.com/i/article/${a.id}` };
}

export function normalizeXPost(t, watched, fetchedAt = new Date().toISOString(), depth = 0) {
  if (!t || t.type === 'tombstone' || t.author?.protected || depth > 1) return null;
  const id = String(t.id ?? ''); const author = t.author?.screen_name;
  if (!/^\d{2,20}$/.test(id) || !/^[A-Za-z0-9_]{1,15}$/.test(author || '')) return null;
  const ms = t.created_timestamp ? Number(t.created_timestamp) * 1000 : Date.parse(t.created_at);
  if (!Number.isFinite(ms)) return null;
  const snowflake = Number((BigInt(id) >> 22n) + 1288834974657n);
  // IDs and timestamps disagreeing are excluded rather than assigned an invented date.
  if (Math.abs(ms - snowflake) > 2000) return null;
  const body = typeof t.text === 'string' ? t.text.slice(0, 120000) : '';
  const article = articleData(t.article);
  const quote = depth === 0 ? normalizeXPost(t.quote, null, fetchedAt, 1) : null;
  const media = (t.media?.photos || []).map(p => xImageURL(p.url)).filter(Boolean).slice(0, 8);
  const videoThumbnail = xImageURL(t.media?.videos?.[0]?.thumbnail_url);
  // Public media-only posts and replies are valid even when display text is empty.
  if (!body.trim() && !article && !quote && !media.length && !videoThumbnail) return null;
  const thumbnail = article?.cover || media[0] || videoThumbnail || quote?.thumbnail || '';
  const parent = typeof t.replying_to === 'object' && t.replying_to ? t.replying_to : null;
  const replyToId = parent?.status || t.replying_to_status || null;
  const replyToAuthor = parent?.screen_name || (typeof t.replying_to === 'string' ? t.replying_to : null);
  const own = !t.reposted_by && (!watched || same(author, watched));
  const kind = replyToId ? 'reply' : article ? 'article' : t.is_note_tweet || body.length >= 600 ? 'long' : quote ? 'quote' : 'post';
  const title = article?.title || quote?.article?.title || body.split('\n').find(s => s.trim() && !/^https?:\/\/\S+$/.test(s.trim()))?.trim().slice(0, 160) || quote?.title || '图片或链接帖子';
  return {
    id, author, authorName: String(t.author.name || author).slice(0, 100), avatar: xImageURL(t.author.avatar_url),
    url: `https://x.com/${author}/status/${id}`, publishedAt: new Date(ms).toISOString(), fetchedAt,
    body, title, article, quote, quoteUnavailable: !!t.quote && !quote,
    own, watchedAccount: watched, kind, replyToId: replyToId ? String(replyToId) : null, replyToAuthor,
    repostedBy: t.reposted_by?.screen_name || null, thumbnail, media, isPinned: t.is_pinned === true,
    metrics: { views: count(t.views), likes: count(t.likes), bookmarks: count(t.bookmarks), reposts: count(t.reposts ?? t.retweets), replies: count(t.replies) },
    fingerprint: hash([id, body, article?.title, article?.body || article?.preview, quote?.fingerprint || null]),
  };
}

export function anonymousPinnedID(html) {
  // Inspect data markers only; never evaluate downloaded JavaScript or visit a user session.
  const entry = html.match(/__typename:"TimelinePinEntry"([\s\S]{0,1600})/);
  if (entry && /context_type:"Pin"/.test(entry[1])) {
    const id = entry[1].match(/rest_id:"(\d{2,20})"/)?.[1];
    if (id) return id;
  }
  return null;
}

export function postText(post) {
  const pieces = [`作者：${post.authorName} (@${post.author})`, `发布时间：${post.publishedAt}`, `原帖：${post.url}`, `作者原帖文字：\n${post.body}`];
  if (post.article) pieces.push(`作者长文《${post.article.title}》（${post.article.contentStatus === 'body_received' ? '已取得正文' : '仅取得预览'}）：\n${post.article.body || post.article.preview}`);
  if (post.quote) {
    const q = post.quote;
    pieces.push(`以下为被引用内容，不是观察账号本人创作。作者：${q.authorName} (@${q.author})；原帖：${q.url}；发布时间：${q.publishedAt}\n${q.body}`);
    if (q.article) pieces.push(`被引用长文《${q.article.title}》（${q.article.contentStatus === 'body_received' ? '已取得正文' : '仅取得预览'}）：\n${q.article.body || q.article.preview}`);
  } else if (post.quoteUnavailable) pieces.push('被引用内容未能取得，不能根据作者短评推断原文事实。');
  return pieces.join('\n\n');
}
export function xContentFingerprint(post) { return hash([post.id, post.body, post.article?.title, post.article?.body || post.article?.preview, post.quote ? xContentFingerprint(post.quote) : null]); }
export function mergeXPost(previous, next) {
  if (!previous || previous.id !== next.id) return next;
  const merged = { ...previous, ...next };
  if (previous.article?.body && next.article?.id === previous.article.id && !next.article.body && next.article.title === previous.article.title && next.article.preview === previous.article.preview) {
    merged.article = { ...next.article, body: previous.article.body, cover: next.article.cover || previous.article.cover, contentStatus: 'body_received', bodyFetchedAt: previous.article.bodyFetchedAt || previous.fullTextFetchedAt || previous.fetchedAt };
  }
  if (previous.quote && next.quote?.id === previous.quote.id) merged.quote = mergeXPost(previous.quote, next.quote);
  merged.thumbnail = next.thumbnail || merged.article?.cover || merged.quote?.thumbnail || '';
  merged.fingerprint = xContentFingerprint(merged);
  return merged;
}

export function xMaterial(post, posts = [], { full = false } = {}) {
  const descendants = selfThread(post, posts);
  let summary = postText(post);
  if (descendants.length) summary += '\n\n已取得的作者续帖（串文可能不完整）：\n' + descendants.map(postText).join('\n\n');
  const max = full ? 200000 : 16000;
  if (summary.length > max) summary = summary.slice(0, max) + '\n[选题材料在这里截断；完整已采集正文可在 X 信号源查看，写作前请读取原文。]';
  return { id: 'x-' + post.id, title: post.title, summary, source: `X · ${post.authorName} (@${post.author})`, sourceKind: 'x', url: post.url, publishedAt: post.publishedAt, discoveredAt: post.fetchedAt, fetchedAt: post.fetchedAt, fingerprint: hash([post.fingerprint, descendants.map(p => p.fingerprint)]), verification: '公开来源材料；不代表事实已核实', contentStatus: post.article?.contentStatus === 'preview_only' || post.quote?.article?.contentStatus === 'preview_only' ? 'preview_only' : post.quoteUnavailable ? 'quote_unavailable' : 'body_received', threadNotice: '仅保留已取得的作者续帖，不能保证串文完整', articleURL: post.article?.url || null, quoteURL: post.quote?.url || null, quoteAuthor: post.quote?.author || null };
}

export function selfThread(root, posts) {
  const included = new Set([root.id]); const out = [];
  const remaining = posts.filter(p => p.own && same(p.author, root.author) && p.replyToId && p.id !== root.id).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  for (let pass = 0; pass < remaining.length; pass++) {
    let changed = false;
    for (const p of remaining) if (!included.has(p.id) && included.has(p.replyToId)) { out.push(p); included.add(p.id); changed = true; }
    if (!changed) break;
  }
  return out.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}

export function xCandidates(accounts, snapshots, q = '', clock = Date.now()) {
  const groups = [];
  for (const a of accounts.filter(a => a.enabled)) {
    const snapshot = snapshots.find(s => same(s.handle, a.handle));
    const group = [];
    for (const p of snapshot?.posts || []) {
      const ms = Date.parse(p.publishedAt);
      if (!p.own || p.replyToId || ms < clock - 7 * DAY || ms > clock) continue;
      const item = xMaterial(p, snapshot.posts);
      if (!q || (item.title + item.summary).toLowerCase().includes(q.toLowerCase())) group.push({ post: p, item });
    }
    group.sort((a, b) => b.post.publishedAt.localeCompare(a.post.publishedAt));
    const chosen = new Map();
    const popular = [...group].sort((a, b) => ((b.post.metrics.bookmarks ?? -1) - (a.post.metrics.bookmarks ?? -1)) || b.post.publishedAt.localeCompare(a.post.publishedAt));
    for (let n = 0; n < 6; n++) for (const row of [group[n], popular[n]]) if (row) chosen.set(row.item.id, row.item);
    for (const row of group) if (chosen.size < 12) chosen.set(row.item.id, row.item);
    groups.push([...chosen.values()]);
  }
  // Round-robin preserves account diversity when the observation list grows.
  const chosen = new Map();
  for (let n = 0; n < 12 && chosen.size < 48; n++) for (const group of groups) if (group[n] && chosen.size < 48) chosen.set(group[n].id, group[n]);
  return [...chosen.values()];
}

function excludedXRecord(raw, handle, start, end) {
  const id = String(raw?.id ?? ''), author = raw?.author?.screen_name || '';
  const validID = /^\d{2,20}$/.test(id), validAuthor = /^[A-Za-z0-9_]{1,15}$/.test(author);
  const ms = raw?.created_timestamp ? Number(raw.created_timestamp) * 1000 : Date.parse(raw?.created_at);
  const validDate = validID && Number.isFinite(ms) && Math.abs(ms - Number((BigInt(id) >> 22n) + 1288834974657n)) <= 2000;
  const outside = validDate && (ms < start || ms > end);
  const other = !!raw?.reposted_by || (validAuthor && !same(author, handle));
  const reason = raw?.type === 'tombstone' ? '来源未提供这条帖子的内容' : raw?.author?.protected ? '来源标记为非公开内容' : !validID ? '帖子编号缺失或格式异常' : !validAuthor ? '作者用户名缺失或格式异常' : !Number.isFinite(ms) ? '发布日期缺失或格式异常' : !validDate ? '发布日期与帖子编号不一致' : '没有可读取的文字、长文或公开媒体';
  return { id: validID ? id : null, author: validAuthor ? author : null, publishedAt: validDate ? new Date(ms).toISOString() : null, reason, scope: outside ? 'outside_window' : other ? 'other_account' : 'requested_window_or_unknown', affectsWindow: !outside && !other };
}

export async function collectXAccount(account, { fetchJSON, fetchProfile, previous = null, clock = Date.now(), maxPages = 10, progress = () => {} }) {
  const handle = xHandle(account.handle); const at = new Date(clock).toISOString(); const start = clock - X_HISTORY_DAYS * DAY;
  const previousPosts = new Map((previous?.posts || []).map(p => [p.id, p]));
  const fresh = new Map(); const cursors = new Set(); const pageRequests = [];
  const excludedRecords = []; let skippedOutsideWindow = 0, skippedOtherAccounts = 0;
  let cursor, pages = 0, rejected = 0, reachedBoundary = false, exhausted = false, error = '', retryAt = null, oldPages = 0, rateLimited = false;
  try {
    for (let n = 0; n < maxPages; n++) {
      progress(`正在读取 @${handle} · 第 ${n + 1} 页公开帖子`);
      const u = new URL(`https://api.fxtwitter.com/2/profile/${handle}/statuses`);
      u.searchParams.set('count', '100'); if (cursor) u.searchParams.set('cursor', cursor);
      const response = await fetchJSON(u.href);
      const data = response.data ?? response;
      requireValue(data.code === 200 && Array.isArray(data.results), '公开来源返回格式改变或账号不可读取');
      pages++; pageRequests.push({ at, cacheAge: response.cacheAge ?? null, returned: data.results.length });
      const datedOwn = [];
      for (const raw of data.results) {
        const p = normalizeXPost(raw, handle, at);
        if (!p) {
          const excluded = excludedXRecord(raw, handle, start, clock);
          if (excluded.affectsWindow) rejected++;
          else if (excluded.scope === 'outside_window') skippedOutsideWindow++;
          else skippedOtherAccounts++;
          if (excludedRecords.length < 100) excludedRecords.push({ ...excluded, page: pages });
          continue;
        }
        if (!p.own) continue;
        datedOwn.push(p);
        if (Date.parse(p.publishedAt) >= start && Date.parse(p.publishedAt) <= clock) fresh.set(p.id, mergeXPost(previousPosts.get(p.id), p));
      }
      if (datedOwn.length && datedOwn.every(p => Date.parse(p.publishedAt) < start && !p.isPinned)) oldPages++; else oldPages = 0;
      if (oldPages >= 2) { reachedBoundary = true; break; }
      const next = data.cursor?.bottom;
      if (!next || !data.results.length) { exhausted = true; break; }
      if (cursors.has(next)) { error = '来源重复返回同一分页游标，已停止；历史可能不完整'; break; }
      cursors.add(next); cursor = next;
    }
  } catch (e) { error = e.message; retryAt = e.retryAt || null; rateLimited = !!e.rateLimited; }

  const capReached = pages >= maxPages && !reachedBoundary && !exhausted && !error;
  const merged = new Map((previous?.posts || []).filter(p => Date.parse(p.publishedAt) >= start).map(p => [p.id, p]));
  fresh.forEach(p => merged.set(p.id, p));
  let pinned = previous?.pinned || null;
  let pinReport = { status: 'unavailable', at, error: '置顶状态尚未核实' };
  // Pin failure must not turn a successful history read into a failure or erase the last pin snapshot.
  if (pages && !rateLimited) {
    try {
      progress(`正在核对 @${handle} 的公开置顶状态`);
      let pinID = [...fresh.values()].find(p => p.isPinned)?.id;
      const pinSource = pinID ? 'FxEmbed 置顶标记' : 'X 匿名主页的置顶标记';
      if (!pinID) {
        const html = await fetchProfile(handle);
        pinID = anonymousPinnedID(html);
        if (!pinID) throw new Error('匿名主页未提供可确认的置顶标记；不能据此断言没有置顶帖');
      }
      const response = await fetchJSON(`https://api.fxtwitter.com/status/${pinID}`);
      const data = response.data ?? response;
      requireValue(data.code === 200, '置顶正文未能读取');
      const post = normalizeXPost(data.tweet ?? data.status, handle, at);
      requireValue(post?.own && post.id === pinID, '置顶正文与观察账号不匹配');
      pinned = { ...post, isPinned: true, pinVerifiedAt: at, pinSource };
      pinReport = { status: 'confirmed', at, source: pinSource };
      // Recent pins can be evidence; an old pin is never assigned today's publication date.
      if (Date.parse(post.publishedAt) >= start && Date.parse(post.publishedAt) <= clock) merged.set(post.id, { ...post, isPinned: true });
    } catch (e) { pinReport = { status: 'unavailable', at, error: e.message }; }
  }
  const posts = [...merged.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 1500);
  const freshRoots = [...fresh.values()].filter(p => !p.replyToId);
  const status = error ? pages ? 'partial' : 'error' : capReached || rejected ? 'partial' : 'ok';
  const completeAtBoundary = (reachedBoundary || exhausted) && !error && !rejected;
  const report = {
    status, error: error || (capReached ? `已达 ${maxPages} 页上限，历史可能不完整` : rejected ? `${rejected} 条请求范围内或时间不明的异常记录被排除，展开详情可查看原因` : ''),
    requestedStart: new Date(start).toISOString(), requestedEnd: at, pages, received: fresh.size, receivedRoots: freshRoots.length,
    skippedInvalid: rejected, skippedOutsideWindow, skippedOtherAccounts, excludedRecords, reachedBoundary, exhausted, completeAtBoundary, capReached, pageRequests,
    earliestReceived: [...fresh.values()].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[0]?.publishedAt || null,
    lastAttemptAt: at, lastSuccessAt: pages ? at : previous?.report?.lastSuccessAt || null, retryAt, pin: pinReport,
    notice: '达到时间边界只代表本次分页结束，不能证明上游返回了全部帖子。转发与普通回复不参与选题。',
  };
  return { id: 'x-account-' + handle.toLowerCase(), handle, name: posts[0]?.authorName || account.name || handle, avatar: posts[0]?.avatar || previous?.avatar || '', posts, pinned, report, provider: X_PROVIDER, fetchedAt: at };
}
