import { hash, now } from './core.mjs';
import { normalizeXPost, mergeXPost } from './x-source.mjs';

const API = 'https://api.fxtwitter.com';
const strategyList = (post, end) => {
  const day = 86400000, first = Math.floor(Date.parse(post.publishedAt) / day) * day;
  const last = Math.floor(end / day) * day, slicedStart = Math.max(first, last - 11 * day);
  const slices = [];
  if (first < slicedStart) slices.push({ key: 'search-older', since: new Date(first).toISOString().slice(0, 10), until: new Date(slicedStart).toISOString().slice(0, 10), label: '按时间补全 · 较早评论' });
  for (let from = slicedStart; from <= last; from += day) {
    const since = new Date(from).toISOString().slice(0, 10), until = new Date(from + day).toISOString().slice(0, 10);
    slices.push({ key: 'search-day-' + since, since, until, label: '按时间补全 · ' + since });
  }
  return [
  { key: 'conversation-recency', kind: 'conversation', mode: 'recency', label: '最新评论' },
  { key: 'conversation-likes', kind: 'conversation', mode: 'likes', label: '高赞评论' },
  { key: 'search-latest', kind: 'search', mode: 'latest', label: '搜索补全 · 最新' },
  { key: 'search-top', kind: 'search', mode: 'top', label: '搜索补全 · 热门' },
  { key: 'search-media', kind: 'search', mode: 'media', label: '图片评论补全' },
  ...slices.map(s => ({ ...s, kind: 'search', mode: 'latest' })),
].map(s => ({ ...s, cursor: '', seen: [], pages: 0, status: 'active', error: '' }));
};

export function publicComments(snapshot) {
  if (!snapshot) return null;
  const { pending, checkpoints, parentAttempts, revision, ...visible } = snapshot;
  return visible;
}
function routeURL(route, root) {
  const u = new URL(route.kind === 'search' ? API + '/2/search' : API + '/2/conversation/' + root);
  if (route.kind === 'search') {
    u.searchParams.set('q', 'conversation_id:' + root + (route.since ? ` since:${route.since} until:${route.until}` : ''));
    u.searchParams.set('feed', route.mode); u.searchParams.set('count', '100');
  } else u.searchParams.set('ranking_mode', route.mode);
  if (route.cursor) u.searchParams.set('cursor', route.cursor);
  return u.href;
}
function relatedRecords(rootId, records) {
  const known = new Set([rootId]), comments = [], children = new Map(), queue = [rootId];
  for (const row of records.values()) {
    if (!children.has(row.replyToId)) children.set(row.replyToId, []);
    children.get(row.replyToId).push(row);
  }
  for (let i = 0; i < queue.length; i++) for (const row of children.get(queue[i]) || []) if (!known.has(row.id)) {
    comments.push(row); known.add(row.id); queue.push(row.id);
  }
  return { comments: comments.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), pending: [...records.values()].filter(r => !known.has(r.id)) };
}
function mergeComment(old, row, source, at) {
  const next = mergeXPost(old, row);
  const changed = old && old.fingerprint !== next.fingerprint;
  const metricsChanged = !old || JSON.stringify(old.metrics) !== JSON.stringify(next.metrics);
  return { ...next, firstSeenAt: old?.firstSeenAt || at, lastSeenAt: at,
    sources: [...new Set([...(old?.sources || []), source])],
    versions: [...(old?.versions || []), ...(changed ? [{ at, previousBody: old.body, previousFingerprint: old.fingerprint }] : [])].slice(-5),
    metricSnapshots: [...(old?.metricSnapshots || []), ...(metricsChanged ? [{ at, ...next.metrics }] : [])].slice(-10) };
}

// Each page is saved before fetching the next. No cookies, X credentials or model calls.
export async function collectXComments(post, { fetchJSON, previous = null, refresh = false,
  maxRequests = 40, maxDurationMs = 120000, progress = () => {}, onCheckpoint = async () => {}, clock = Date.now } = {}) {
  if (!/^\d{2,20}$/.test(post.id) || !post.author) throw new Error('评论所属帖子无效');
  if (previous && previous.postId !== post.id) throw new Error('续采记录与帖子不一致');
  const start = clock(), at = now();
  const records = new Map([...(previous?.comments || []), ...(previous?.pending || [])].map(p => [p.id, p]));
  const strategies = strategyList(post, start);
  const checkpoints = refresh || !previous?.checkpoints ? strategies : structuredClone(previous.checkpoints);
  for (const s of strategies) if (!checkpoints.some(p => p.key === s.key)) checkpoints.push(s);
  const parentAttempts = refresh ? {} : { ...(previous?.parentAttempts || {}) };
  const failures = new Map();
  const retryable = s => s.status === 'blocked' && !/\b404\b|分页未推进/.test(s.error);
  for (const s of checkpoints) if (retryable(s)) s.status = 'active';
  let requests = 0, pages = 0, duplicates = 0, excluded = 0, limited = false, retryAt = null;
  let reportedReplies = previous?.report?.reportedReplies ?? post.metrics?.replies ?? null;
  const initial = new Set(previous?.comments?.map(c => c.id) || []);
  let result;
  const withinBudget = () => requests < maxRequests && clock() - start < maxDurationMs && !limited;
  const absorb = (raw, source) => {
    if (raw?.id === post.id) { if (Number.isSafeInteger(raw.replies) && raw.replies >= 0) reportedReplies = raw.replies; return; }
    const row = normalizeXPost(raw, null, now());
    if (!row || !/^\d{2,20}$/.test(row.replyToId || '') || row.repostedBy || Date.parse(row.publishedAt) < Date.parse(post.publishedAt)) { excluded++; return; }
    const old = records.get(row.id); if (old) duplicates++;
    records.set(row.id, mergeComment(old, row, source, now()));
  };
  const save = async () => {
    const { comments, pending } = relatedRecords(post.id, records);
    const unresolved = [...new Set(pending.map(p => p.replyToId).filter(id => id !== post.id && !records.has(id)))];
    const canContinue = checkpoints.some(s => s.status === 'active' || retryable(s)) || unresolved.some(id => !parentAttempts[id]);
    const errors = checkpoints.filter(s => s.error).map(s => ({ source: s.label, message: s.error }));
    const traversed = checkpoints.every(s => s.status === 'exhausted');
    result = { id: 'x-comments-' + post.id, postId: post.id, handle: post.author, rootURL: post.url,
      comments, pending, checkpoints, parentAttempts,
      report: { status: traversed && !pending.length ? 'traversed' : comments.length ? 'partial' : 'error',
        lastAttemptAt: at, lastSavedAt: now(), lastSuccessAt: pages ? now() : previous?.report?.lastSuccessAt || null,
        count: comments.length, newCount: comments.filter(c => !initial.has(c.id)).length,
        reportedReplies, pagesThisRun: pages, requestsThisRun: requests, duplicatesThisRun: duplicates, excludedThisRun: excluded,
        totalPages: checkpoints.reduce((n, s) => n + s.pages, 0), unresolvedCount: pending.length,
        canContinue, budgetReached: requests >= maxRequests || clock() - start >= maxDurationMs, limited, retryAt,
        routes: checkpoints.map(({ label, pages, status }) => ({ label, pages, status })), errors,
        notice: '按评论关联确认归属，最新与热门结果合并去重。计数是已取得的公开评论快照。' } };
    await onCheckpoint(result);
    return result;
  };
  // Interleave rankings so one long result set cannot starve the other approaches.
  while (withinBudget() && checkpoints.some(s => s.status === 'active')) {
    for (const route of checkpoints) {
      if (!withinBudget()) break;
      if (route.status !== 'active') continue;
      requests++; progress(`正在补全评论：${route.label}，已保存 ${relatedRecords(post.id, records).comments.length} 条`);
      try {
        const { data } = await fetchJSON(routeURL(route, post.id));
        if (data.code !== 200) throw new Error('公开来源返回 ' + (data.code || '未知状态'));
        const rows = route.kind === 'search' ? data.results : data.replies;
        if (!Array.isArray(rows)) throw new Error('公开来源没有返回评论列表');
        for (const row of [data.status, ...(data.thread || []), ...rows].filter(Boolean)) absorb(row, route.key);
        pages++; route.pages++; route.error = '';
        route.emptyPages = rows.length ? 0 : (route.emptyPages || 0) + 1;
        const pageHash = rows.length ? hash(rows.map(p => p.id).sort()) : null;
        route.pageHashes ||= [];
        if (pageHash && route.pageHashes.includes(pageHash)) throw new Error('来源分页未推进，重复返回同一批评论');
        if (pageHash) route.pageHashes.push(pageHash);
        const currentHash = hash(route.cursor); route.seen.push(currentHash);
        const cursor = data.cursor?.bottom;
        if (!cursor || route.emptyPages >= 2) {
          route.status = 'exhausted'; route.cursor = '';
        } else if (typeof cursor !== 'string' || cursor.length > 10000 || route.seen.includes(hash(cursor))) {
          throw new Error('来源分页未推进，已保存目前取得的评论');
        } else route.cursor = cursor;
      } catch (e) {
        const tries = (failures.get(route.key) || 0) + 1; failures.set(route.key, tries);
        const transient = /连接|网络|超时|network|timeout|fetch failed|ECONN|ENOTFOUND|\b50[234]\b/i.test(e.message);
        route.status = transient && !e.rateLimited && tries < 2 ? 'active' : 'blocked';
        route.error = String(e.message).slice(0, 500); route.failedAt = now();
        if (e.rateLimited) { limited = true; retryAt = e.retryAt || null; }
      }
      await save();
    }
  }
  // Some search pages contain children without their parents. Read only missing parents,
  // then confirm the chain reaches the root; unrelated results never enter visible comments.
  let parentsRead = 0;
  while (withinBudget() && parentsRead < 12) {
    const { pending } = relatedRecords(post.id, records);
    const id = pending.map(p => p.replyToId).find(id => id !== post.id && !records.has(id) && !parentAttempts[id]);
    if (!id) break;
    requests++; parentsRead++; parentAttempts[id] = { at: now(), status: 'attempted' };
    try {
      const { data } = await fetchJSON(API + '/status/' + id);
      const row = data.tweet || data.status;
      if (data.code !== 200 || row?.id !== id) throw new Error('父评论未取得');
      absorb(row, 'parent'); parentAttempts[id].status = 'received';
    } catch (e) { parentAttempts[id].status = 'unavailable'; if (e.rateLimited) { limited = true; retryAt = e.retryAt || null; } }
    await save();
  }
  return save();
}
