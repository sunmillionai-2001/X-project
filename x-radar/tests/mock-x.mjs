// Synthetic public posts. This module is imported only by isolated acceptance tests.
const at = Date.now(); const actors = new Map(), statuses = new Map();
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
function actor(handle) {
  if (actors.has(handle)) return actors.get(handle);
  const serial = actors.size * 100;
  const make = (minutes, n, fields = {}) => {
    const ms = at - minutes * 60000;
    const p = { type: 'status', id: ((BigInt(ms - 1288834974657) << 22n) + BigInt(serial + n)).toString(), text: '合成 X 功能测试材料，不能当成真实资讯。', created_timestamp: Math.floor(ms / 1000), author: { screen_name: handle, name: '测试 ' + handle }, views: 12345, likes: 42, bookmarks: 26, ...fields };
    statuses.set(p.id, p); return p;
  };
  const root = make(10, 1, { text: '合成 AI 工具玩法：测试长文正文与封面。', article: { id: '2104910491625607168', title: '合成 AI 工具长文 · ' + handle, preview_text: '这是合成预览，仅用于隔离验收。', content: { blocks: [{ text: '合成全文段落甲。' }, { text: '合成全文段落乙。' }] } } });
  const quote = make(20, 2, { text: '这太强了（合成测试短评）', quote: make(30, 3, { author: { screen_name: 'QuotedAuthor', name: '合成被引用作者' }, text: '被引用的 AI 玩法，需核对原作者。' }) });
  const reply = make(9, 4, { text: '合成作者续帖一', replying_to: { status: root.id, screen_name: handle } });
  const reply2 = make(8, 5, { text: '合成作者续帖二', replying_to: { status: reply.id, screen_name: handle } });
  const repost = make(5, 6, { author: { screen_name: 'OtherAuthor' }, reposted_by: { screen_name: handle }, text: '纯转发，不应进入选题池' });
  const pin = make(30 * 1440, 7, { text: '', article: { id: '2104910491625607169', title: '合成旧置顶 · ' + handle, content: { blocks: [{ text: '旧置顶正文不作为今天新热点。' }] } } });
  const studyPosts = handle === 'StudyAI' ? [make(40, 8, { text: '合成知识型帖子：先说明具体问题，再写操作步骤和限制，这是研究测试。', bookmarks: 180 }), make(80, 9, { text: '合成知识型帖子：用读者的普通场景说明工具用途，最后说明验证方法。', bookmarks: 65 }), make(120, 10, { text: '合成知识型帖子：介绍一个新的工作流程，同时区分已知事实与个人判断。', bookmarks: 12 }), make(180, 11, { text: '合成知识型帖子：讨论为什么一条内容需要有可以回到原文的材料依据。', bookmarks: 4 })] : [];
  const comment1 = make(7, 12, { text: '合成读者问题：这个工具支持中文吗？', author: { screen_name: 'ReaderOne', name: '合成读者甲' }, replying_to: { status: root.id, screen_name: handle } });
  const comment2 = make(6, 13, { text: '合成读者问题：怎么开始使用？', author: { screen_name: 'ReaderTwo', name: '合成读者乙' }, replying_to: { status: root.id, screen_name: handle } });
  const nested = make(5, 14, { text: '合成读者回复：需要先注册。', author: { screen_name: 'ReaderThree', name: '合成读者丙' }, replying_to: { status: comment2.id, screen_name: 'ReaderTwo' } });
  const data = { handle, root, quote, reply, reply2, repost, pin, studyPosts, comment1, comment2, nested }; actors.set(handle, data); return data;
}
export async function mockXFetch(u, options = {}) {
  if (u.hostname === 'pbs.twimg.com') return new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNAAAAABJRU5ErkJggg==', 'base64'), { headers: { 'Content-Type': 'image/png' } });
  if (!['api.fxtwitter.com', 'x.com'].includes(u.hostname)) return null;
  const headers = new Headers(options.headers);
  if (headers.has('Cookie') || headers.has('Authorization')) throw Error('X mock refuses any user session or credential');
  if (u.hostname === 'x.com') { const a = actor(u.pathname.slice(1)); return new Response(`__typename:"TimelinePinEntry",context_type:"Pin",rest_id:"${a.pin.id}"`); }
  const handle = u.pathname.match(/^\/2\/profile\/([^/]+)\/statuses$/)?.[1];
  if (handle === 'FailAI') return json({ code: 503 }, 503);
  if (handle === 'RateAI') return json({ code: 429 }, 429, { 'Retry-After': '3600' });
  if (handle) {
    const a = actor(handle);
    return json({ code: 200, results: u.searchParams.has('cursor') ? [a.root] : [a.root, a.quote, a.reply, a.repost, ...a.studyPosts], cursor: { bottom: u.searchParams.has('cursor') ? null : 'second-page' } });
  }
  const id = u.pathname.split('/').at(-1);
  if (u.pathname.startsWith('/2/conversation/')) {
    const a = [...actors.values()].find(a => a.root.id === id);
    return a && !u.searchParams.has('cursor') ? json({ code: 200, status: a.root, replies: [a.comment1], cursor: { bottom: 'broken-page' } }) : json({ code: 404 }, 404);
  }
  if (u.pathname === '/2/search') {
    const rootId = u.searchParams.get('q')?.match(/^conversation_id:(\d+)(?:\s|$)/)?.[1];
    const a = [...actors.values()].find(a => a.root.id === rootId);
    if (!a) return json({ code: 404 });
    return json({ code: 200, results: u.searchParams.has('cursor') ? [a.comment2] : [a.comment1, a.nested], cursor: { bottom: u.searchParams.has('cursor') ? null : 'search-second-page' } });
  }
  if (u.pathname.startsWith('/2/thread/')) { const a = [...actors.values()].find(a => a.root.id === id); return a ? json({ code: 200, status: a.root, thread: [a.root, a.reply, a.reply2] }) : json({ code: 404 }); }
  return statuses.has(id) ? json({ code: 200, tweet: statuses.get(id) }) : json({ code: 404 });
}
