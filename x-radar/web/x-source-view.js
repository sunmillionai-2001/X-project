const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = v => v ? new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '尚无记录';
const safeImage = v => { try { const u = new URL(v); return u.protocol === 'https:' && ['pbs.twimg.com', 'abs.twimg.com'].includes(u.hostname) && !u.username && !u.password && !u.port ? u.href : ''; } catch { return ''; } };
const imagePath = v => '/api/x/image?url=' + encodeURIComponent(v);
const link = (url, label) => { try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password ? `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label); } catch { return esc(label); } };
const btn = (label, action, extra = '', primary = false) => `<button data-action="${action}" ${extra} class="${primary ? 'primary' : ''}">${label}</button>`;
const numeric = v => v === null || v === undefined ? '—' : v >= 10000 ? (v / 10000).toFixed(1) + '万' : v >= 1000 ? (v / 1000).toFixed(1) + '千' : String(v);
const typeName = p => p.article ? 'X 长文' : p.kind === 'long' ? '长帖' : p.quote ? '引用帖' : '原帖';
function avatar(name, image) { return `<span class="x-avatar"><span>${esc([...name][0] || 'X')}</span>${safeImage(image) ? `<img src="${esc(imagePath(safeImage(image)))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>`; }
function roots(x) {
  const out = [];
  for (const config of x.config.accounts) {
    const account = x.accounts.find(s => s.handle.toLowerCase() === config.handle.toLowerCase());
    const posts = (account?.posts || []).filter(p => p.own && !p.replyToId);
    for (const post of posts) out.push({ ...post, handle: config.handle, enabled: config.enabled, account });
  }
  return out;
}
function matches(p, filters, now = Date.now()) {
  if (filters.account !== 'all' && p.handle.toLowerCase() !== filters.account.toLowerCase()) return false;
  if (filters.range !== 'all' && Date.parse(p.publishedAt) < now - Number(filters.range) * 86400000) return false;
  if (filters.type === 'long' && !p.article && p.kind !== 'long' && !p.quote?.article) return false;
  if (filters.type === 'quote' && !p.quote && !p.quoteUnavailable) return false;
  const haystack = [p.title, p.body, p.author, p.authorName, p.article?.body, p.quote?.body, p.quote?.article?.title].join(' ').toLowerCase();
  return !filters.query || haystack.includes(filters.query.toLowerCase());
}
function sortPosts(posts, sort) {
  return posts.sort((a, b) => sort === 'latest' ? b.publishedAt.localeCompare(a.publishedAt) : ((b.metrics[sort] ?? -1) - (a.metrics[sort] ?? -1)) || b.publishedAt.localeCompare(a.publishedAt));
}
function postCard(p, sort, pin = false) {
  const extra = `data-handle="${esc(p.handle)}" data-id="${esc(p.id)}"`;
  const metric = sort === 'views' ? 'views' : 'bookmarks'; const metricLabel = metric === 'views' ? '曝光' : '收藏';
  const detail = p.article?.preview || p.quote?.article?.preview || p.body;
  const image = safeImage(p.thumbnail);
  return `<article class="x-card${pin ? ' x-pin-card' : ''}">
    <button class="x-cover x-cover-${p.quote ? 'quote' : p.article ? 'article' : 'post'}" data-action="x-open" ${extra} aria-label="查看全文：${esc(p.title)}"><span class="x-cover-fallback"><small>${pin ? 'PINNED · 置顶' : p.quote ? 'QUOTE · 引用' : p.article ? 'ARTICLE · 长文' : 'PUBLIC POST · 公开原帖'}</small><strong>${esc(p.title.slice(0, 80))}</strong></span>${image ? `<img src="${esc(imagePath(image))}" alt="${esc(p.title)}的原帖封面" loading="lazy" referrerpolicy="no-referrer">` : ''}</button>
    <div class="x-card-body"><div class="x-card-tags"><span class="tag">${pin ? '置顶参考' : typeName(p)}</span>${!p.enabled ? '<span class="tag">账号已停用</span>' : ''}${p.quote?.article ? '<span class="tag">含引用长文</span>' : ''}</div>
    <button class="x-card-title" data-action="x-open" ${extra}>${esc(p.title)}</button>${p.quote ? `<small class="x-quote-attribution">引用 ${esc(p.quote.authorName)} @${esc(p.quote.author)}</small>` : ''}<p class="x-excerpt">${esc(detail?.slice(0, 220) || p.article?.body?.slice(0, 220) || '原文尚未完整取得，请打开原帖查看。')}</p>
    <div class="x-card-author">${avatar(p.authorName, p.avatar)}<div><strong>${esc(p.authorName)}</strong><small>@${esc(p.author)} · ${numeric(p.metrics.views)} 曝光</small></div><div class="x-card-metric"><strong>${numeric(p.metrics[metric])}</strong><small>${metricLabel}</small></div></div>
    <div class="x-card-bottom"><time datetime="${esc(p.publishedAt)}">${esc(date(p.publishedAt))}</time>${btn('找选题 ↗', 'x-topic', extra)}</div>${p.article?.contentStatus === 'preview_only' || p.quote?.article?.contentStatus === 'preview_only' ? '<small class="x-pin-state">长文目前仅有预览 · 打开详情可读取正文</small>' : ''}${pin ? `<small class="x-pin-state">${p.account.report.pin.status === 'confirmed' ? '置顶核对：' + esc(date(p.pinVerifiedAt)) : '当前置顶未确认 · 展示上次快照'}</small>` : ''}</div></article>`;
}
function reportHTML(account) {
  const r = account?.report;
  if (!r) return '<span class="muted">尚未采集</span>';
  const labels = { ok: '读取成功', partial: '部分取得', error: '读取失败' };
  const excluded = r.excludedRecords?.length ? `<details><summary>查看被排除记录及原因（${r.excludedRecords.length} 条）</summary><ul>${r.excludedRecords.map(p => `<li>${p.id && p.author ? link(`https://x.com/${p.author}/status/${p.id}`, '@' + p.author + ' · ' + p.id) : esc(p.id || '编号未取得')}<br>${esc(p.reason)} · ${p.affectsWindow ? '影响本次采集范围' : p.scope === 'outside_window' ? '已确认在请求时间范围外，不影响本次状态' : '其他账号或转发，不影响本次状态'}${p.publishedAt ? '<br>发布时间：' + esc(date(p.publishedAt)) : ''}</li>`).join('')}</ul></details>` : '';
  return `<span class="x-status ${r.status}">${labels[r.status] || '未知状态'}</span><small>最近尝试：${esc(date(r.lastAttemptAt))}<br>最近成功：${esc(date(r.lastSuccessAt))}<br>请求范围：${esc(date(r.requestedStart))} — ${esc(date(r.requestedEnd))}<br>${r.pages} 页 · 本次 ${r.receivedRoots} 条主帖、${r.received - r.receivedRoots} 条作者回复${r.earliestReceived ? '<br>本次最早帖子：' + esc(date(r.earliestReceived)) : ''}</small>${r.error ? `<p class="x-report-error">${esc(r.error)}</p>` : ''}${excluded}<small>${r.pin.status === 'confirmed' ? '置顶已确认' : '置顶未确认：' + esc(r.pin.error)}<br>${esc(r.notice)}${r.retryAt ? '<br>限流暂停至：' + esc(date(r.retryAt)) : ''}</small>`;
}
export function xPage(state, filters) {
  const x = state.x; const all = roots(x); const pins = x.config.accounts.map(config => {
    const account = x.accounts.find(s => s.handle.toLowerCase() === config.handle.toLowerCase());
    return account?.pinned ? { ...account.pinned, handle: config.handle, enabled: config.enabled, account } : null;
  }).filter(Boolean);
  const data = filters.type === 'pinned' ? pins.filter(p => matches(p, { ...filters, range: 'all' })) : all.filter(p => matches(p, filters));
  sortPosts(data, filters.sort);
  const pageSize = 24; const displayed = data.slice(0, filters.limit || pageSize);
  const activeAccounts = x.config.accounts.filter(a => a.enabled);
  const bad = x.accounts.filter(a => a.report.status !== 'ok');
  const latest = x.accounts.map(a => a.report.lastSuccessAt).filter(Boolean).sort().at(-1);
  const tabs = [['all', '全部'], ['long', '长文 / 长帖'], ['quote', '引用帖'], ['pinned', '置顶参考']];
  return `<section class="x-page"><div class="hero"><div><div class="eyebrow">Your public X signals</div><h1>X 信号源<span class="x-beta">私人观察名单</span></h1><p>从公开原帖，发现值得写的东西。无需登录 X；刷新采集不调用写作模型。</p></div><div class="actions">${btn('刷新公开帖子', 'x-refresh', '', true)}${btn(state.daily ? '重新筛选今日选题' : '生成今日精选', 'x-daily')}</div></div>
    <div class="x-summary"><span><strong>${activeAccounts.length}</strong> 个启用账号</span><span><strong>${all.length}</strong> 条已缓存主帖</span><span>自动选题取最近 <strong>7</strong> 天</span><small>${latest ? '最近取得：' + esc(date(latest)) : '第一次采集将读取最近 12 天'}${bad.length ? ' · ' + bad.length + ' 个账号存在采集缺口' : ''}</small></div>
    <div class="sectionhead"><h2>观察账号</h2>${btn('管理账号', 'x-manage')}</div><div class="x-accounts">${x.config.accounts.map(config => {
      const account = x.accounts.find(s => s.handle.toLowerCase() === config.handle.toLowerCase());
      const count = all.filter(p => p.handle === config.handle).length;
      const status = !config.enabled ? '已停用' : !account ? '待采集' : account.report.status === 'ok' ? '已读取' : account.report.status === 'partial' ? '部分取得' : '读取失败';
      return `<button class="x-account ${filters.account === config.handle ? 'selected' : ''} ${!config.enabled ? 'paused' : ''}" data-action="x-account-filter" data-handle="${esc(config.handle)}">${avatar(account?.name || config.name, account?.avatar)}<strong>${esc(account?.name || config.name)}</strong><small>@${esc(config.handle)}</small><span><b>${count}</b> 条主帖 · ${status}</span></button>`;
    }).join('') || '<div class="empty"><p>还没有观察账号。添加 @用户名即可开始。</p></div>'}</div>
    <details class="panel x-management" id="x-management"><summary>账号管理与采集状态</summary><p class="muted">支持 @用户名或主页链接，最多 ${esc(x.accountLimit)} 个。停用后保留已缓存内容，但不再采集，也不参与自动选题。</p><div class="x-add"><input id="x-add-handle" placeholder="@用户名 或 https://x.com/用户名" aria-label="添加观察账号"><input id="x-add-name" placeholder="备注名称（选填）" aria-label="账号备注名称">${btn('添加账号', 'x-add', '', true)}</div><div class="x-account-reports">${x.config.accounts.map(config => {
      const account = x.accounts.find(s => s.handle.toLowerCase() === config.handle.toLowerCase());
      return `<div class="x-account-report"><div><strong>${esc(account?.name || config.name)}</strong> <small>@${esc(config.handle)}</small><div class="actions">${btn(config.enabled ? '停用' : '启用', 'x-toggle', `data-handle="${esc(config.handle)}"`)}${config.enabled ? btn('单独刷新', 'x-refresh', `data-handle="${esc(config.handle)}"`) : ''}${btn('移出观察名单', 'x-remove', `data-handle="${esc(config.handle)}"`)}</div></div><div>${reportHTML(account)}</div></div>`;
    }).join('')}</div><p class="muted">来源：${esc(x.provider)}。置顶通过匿名公开主页核对；这些路径不构成独立备用信源。达到 12 天分页边界也不能证明帖子齐全；失败时保留上次快照及其采集时间。</p></details>
    <div class="x-filterbar"><div class="x-chipgroup" aria-label="帖子类型">${tabs.map(([v, label]) => `<button data-action="x-type" data-value="${v}" class="${filters.type === v ? 'selected' : ''}">${label}</button>`).join('')}</div><div class="x-filtercontrols"><select id="x-filter-account" aria-label="筛选观察账号"><option value="all">全部观察账号</option>${x.config.accounts.map(a => `<option value="${esc(a.handle)}" ${filters.account === a.handle ? 'selected' : ''}>${esc(a.name)} @${esc(a.handle)}</option>`).join('')}</select><select id="x-filter-range" aria-label="筛选发布时间" ${filters.type === 'pinned' ? 'disabled' : ''}>${[['1', '24 小时'], ['7', '最近 7 天'], ['12', '最近 12 天'], ['all', '全部已缓存']].map(([v, label]) => `<option value="${v}" ${filters.range === v ? 'selected' : ''}>${label}</option>`).join('')}</select><select id="x-filter-sort" aria-label="帖子排序">${[['latest', '最新发布'], ['bookmarks', '收藏最多'], ['views', '曝光最多'], ['likes', '点赞最多']].map(([v, label]) => `<option value="${v}" ${filters.sort === v ? 'selected' : ''}>${label}</option>`).join('')}</select><input id="x-filter-query" value="${esc(filters.query)}" placeholder="搜标题、正文或作者" aria-label="搜索 X 帖子"></div></div>
    <div class="sectionhead"><h2>${filters.type === 'pinned' ? '置顶参考' : '公开帖子'} <small class="muted">${data.length} 条</small></h2>${filters.account !== 'all' || filters.query || filters.type !== 'all' ? btn('清除筛选', 'x-clear') : '<span class="muted">卡片上的数字为采集时累计值</span>'}</div>
    ${data.length ? `<div class="x-card-grid">${displayed.map(p => postCard(p, filters.sort, filters.type === 'pinned')).join('')}</div>${displayed.length < data.length ? `<div class="x-loadmore">${btn(`再显示 ${Math.min(pageSize, data.length - displayed.length)} 条`, 'x-more')}</div>` : ''}` : `<div class="empty"><h3>${all.length || pins.length ? '这个筛选范围内没有已取得的帖子' : '从你想观察的账号开始'}</h3><p>${all.length || pins.length ? '可以扩大时间范围或清除筛选。空列表不代表账号没有发帖，请查看采集状态。' : '首批已放入鱼总聊 AI、宝玉、OpenAI 与 ChatGPT。采集完成后，公开原帖会显示在这里。'}</p>${btn('刷新公开帖子', 'x-refresh', '', true)}</div>`}
    ${filters.type !== 'pinned' && pins.filter(p => matches(p, { ...filters, type: 'all', range: 'all' })).length ? `<div class="sectionhead"><h2>置顶参考</h2><small class="muted">保留原始发布日期，旧置顶不进入今日热点池</small></div><div class="x-card-grid">${pins.filter(p => matches(p, { ...filters, type: 'all', range: 'all' })).map(p => postCard(p, filters.sort, true)).join('')}</div>` : ''}
    <div class="x-source-note"><strong>选题怎么用这些材料？</strong><p>最近 7 天的本人主帖和引用帖参与筛选；普通回复与纯转发不单独参与。每账号最多取 12 条，兼顾新帖和高收藏，全名单最多 48 条 X 材料。与 AIHOT 合并后，由写作模型判断普通读者能获得什么，合并重复事件，最多推荐 5 个，不凑数。“找选题”只围绕当前帖子生成角度；两个选题按钮都会使用已配置的写作 API。</p><small>长文封面、头像来自原帖。曝光、收藏等是公开服务返回的累计快照，未知显示“—”；不是新增流量、全站榜单或事实核实结论。</small></div></section>`;
}

export function xReader(state, selected) {
  if (!selected) return '';
  const account = state.x.accounts.find(a => a.handle.toLowerCase() === selected.handle.toLowerCase());
  const p = account?.posts.find(p => p.id === selected.id) || (account?.pinned?.id === selected.id ? account.pinned : null);
  if (!p) return '';
  const extra = `data-handle="${esc(selected.handle)}" data-id="${esc(p.id)}"`;
  const quote = p.quote;
  const included = new Set([p.id]); const replies = [];
  const candidates = account.posts.filter(i => i.own && i.author.toLowerCase() === p.author.toLowerCase() && i.replyToId).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  for (let n = 0; n < candidates.length; n++) { let changed = false; for (const i of candidates) if (!included.has(i.id) && included.has(i.replyToId)) { included.add(i.id); replies.push(i); changed = true; } if (!changed) break; }
  const article = a => a ? `<section class="x-article"><h3>${esc(a.title)}</h3><small>${a.body ? '已取得长文正文' : '仅取得长文预览 · 正文未取得'}${a.bodyFetchedAt ? ' · 正文快照：' + esc(date(a.bodyFetchedAt)) : ''} · ${link(a.url, '打开原文')}</small><div class="pre">${esc(a.body || a.preview)}</div></section>` : '';
  return `<dialog id="x-reader" class="x-reader"><div class="x-reader-top"><span class="tag">公开原帖 · ${typeName(p)}</span>${btn('关闭', 'x-close')}</div><h2>${esc(p.title)}</h2><div class="x-reader-author">${avatar(p.authorName, p.avatar)}<div><strong>${esc(p.authorName)} @${esc(p.author)}</strong><small>${esc(date(p.publishedAt))} 发布 · ${esc(date(p.fetchedAt))} 采集</small></div></div><div class="actions">${link(p.url, '在 X 查看原帖 ↗')}${btn('从这条找选题', 'x-topic', extra, true)}${btn('读取完整长文与串文', 'x-thread', extra)}</div><p class="muted">这是公开来源文字，作者经验不能写成你的亲测。引用内容和串文可能有缺口。</p>${p.contentFetchErrors?.length ? `<div class="notice warn">本次补充读取存在缺口：${p.contentFetchErrors.map(esc).join('；')}</div>` : ''}<div class="pre x-reader-body">${esc(p.body)}</div>${article(p.article)}${quote ? `<section class="x-quote"><span class="tag">被引用内容 · ${esc(quote.authorName)} @${esc(quote.author)}</span><p>${link(quote.url, '被引用原帖')} · ${esc(date(quote.publishedAt))}</p><div class="pre">${esc(quote.body)}</div>${article(quote.article)}</section>` : p.quoteUnavailable ? '<div class="notice warn">被引用内容未能取得，不能从这条短评推断原文事实。</div>' : ''}${replies.length ? `<section class="x-article"><h3>已取得的作者续帖 · ${replies.length} 条</h3>${replies.map(i => `<div class="x-thread-post"><small>${link(i.url, '续帖原文')} · ${esc(date(i.publishedAt))}</small><div class="pre">${esc(i.body)}</div>${article(i.article)}</div>`).join('')}</section>` : ''}<p class="muted">${p.threadFetchedAt ? '串文查询时间：' + esc(date(p.threadFetchedAt)) + '；仍不能保证串文完整。' : '尚未单独查询串文，点击“读取完整长文与串文”可补充公开来源返回的正文和续帖。'}</p><small class="muted">累计快照：曝光 ${numeric(p.metrics.views)} · 收藏 ${numeric(p.metrics.bookmarks)} · 点赞 ${numeric(p.metrics.likes)}</small></dialog>`;
}
