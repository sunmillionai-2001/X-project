import { id, now, text, requireValue, hash } from './core.mjs';

export const VIRAL_DEFAULT_HANDLES = ['gkxspace', 'gengdaJ', 'Khazix0918', 'AI_Jasonyu'];
export const metricNames = { bookmarks: '收藏', views: '阅读', likes: '点赞' };
const strings = (v, min, max, label) => {
  requireValue(Array.isArray(v) && v.length >= min && v.length <= max, `${label}数量不正确`);
  return v.map(s => { const t = text(s, 3000).trim(); requireValue(t, `${label}不能为空`); return t; });
};
export function authorText(post) {
  return [post.body, post.article?.title, post.article?.body || post.article?.preview].filter(Boolean).join('\n\n').trim();
}
export function studySamples(accounts, handles, at = Date.now()) {
  requireValue(Array.isArray(handles) && handles.length >= 1 && handles.length <= 4, '每次研究请选择 1—4 个博主');
  requireValue(new Set(handles.map(h => String(h).toLowerCase())).size === handles.length, '研究账号不能重复');
  const start = at - 12 * 86400000;
  const authors = [], samples = [];
  for (const handle of handles) {
    const a = accounts.find(a => a.handle.toLowerCase() === String(handle).toLowerCase());
    requireValue(a, `@${handle} 尚未取得公开帖子，请先在 X 信号源刷新`);
    const roots = a.posts.filter(p => p.own && !p.replyToId && Date.parse(p.publishedAt) >= start && Date.parse(p.publishedAt) <= at);
    const usable = roots.filter(p => authorText(p).length >= 20);
    requireValue(usable.length >= 3, `@${a.handle} 近 12 天只有 ${usable.length} 条可分析的文字主帖，至少需要 3 条；请先补充公开样本或选择其他博主`);
    const metric = ['bookmarks', 'views', 'likes'].find(k => usable.filter(p => Number.isFinite(p.metrics?.[k])).length >= Math.max(3, Math.ceil(usable.length / 2))) || null;
    const ranked = usable.filter(p => metric && Number.isFinite(p.metrics?.[metric])).sort((a, b) => b.metrics[metric] - a.metrics[metric] || b.publishedAt.localeCompare(a.publishedAt));
    const selected = new Map();
    const add = (p, role) => { if (p && !selected.has(p.id)) selected.set(p.id, { p, role }); };
    if (metric) {
      ranked.slice(0, 2).forEach(p => add(p, '高表现样本'));
      const mid = Math.floor(ranked.length / 2); ranked.slice(mid, mid + 2).forEach(p => add(p, '中间表现样本'));
      add(ranked.at(-1), '低位对照样本');
    }
    [...usable].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).forEach(p => { if (selected.size < 6) add(p, metric ? '近期补充样本' : '近期样本 · 指标不足'); });
    // Pins outside the window are references, never members of the performance comparison.
    if (a.pinned?.own && authorText(a.pinned).length >= 20) add(a.pinned, Date.parse(a.pinned.publishedAt) < start ? '置顶参考 · 窗口外' : '置顶参考');
    const author = { handle: a.handle, name: a.name, rootCount: roots.length, usableCount: usable.length, metric,
      median: metric ? ranked[Math.floor(ranked.length / 2)].metrics[metric] : null,
      metricAvailable: ranked.length, reportStatus: a.report?.status || 'unknown', fetchedAt: a.fetchedAt,
      pinnedId: a.pinned?.id || null, samples: [...selected.keys()] };
    authors.push(author);
    for (const { p, role } of selected.values()) {
      const fullText = authorText(p);
      const ownText = fullText.length > 6500 ? fullText.slice(0, 4500) + '\n[中间内容省略]\n' + fullText.slice(-2000) : fullText;
      samples.push({ id: p.id, handle: a.handle, authorName: a.name, url: p.url, title: p.article?.title || p.body?.split('\n').find(s => s.trim())?.slice(0, 160) || '作者文字',
        publishedAt: p.publishedAt, fetchedAt: p.fullTextFetchedAt || p.fetchedAt, metrics: p.metrics, role,
        rank: metric && ranked.some(q => q.id === p.id) ? ranked.findIndex(q => q.id === p.id) + 1 : null,
        metric, text: ownText, textTruncated: ownText !== fullText,
        contentStatus: p.article?.contentStatus || 'post_text',
        quoteContext: p.quote ? { author: p.quote.author, url: p.quote.url, note: '被引用作者内容不用于观察博主的写作风格归因' } : null });
    }
  }
  return { authors, samples, windowStart: new Date(start).toISOString(), windowEnd: new Date(at).toISOString(),
    limitations: ['只研究当前已取得的公开样本，近 12 天覆盖和串文可能有缺口。', '表现排名仅在同一作者已取得的文字主帖内比较；收藏、阅读和点赞为取得时的累计值，帖龄不同且会变化。', '指标缺失按未知处理，不以零代替；窗口外置顶只作参考。', '文字观察和传播机制推断分开，不据此推断涨粉、收入、算法或保证爆款。', '只分析作者自己的文字；图片内容与未取得的正文不作为已读证据。'] };
}
function evidence(v, bundle, handle = null) {
  requireValue(Array.isArray(v) && v.length >= 1 && v.length <= 8, `研究结论需引用原帖证据（1—8 条），当前数量：${Array.isArray(v) ? v.length : '格式不正确'}`);
  return v.map(e => {
    const s = bundle.samples.find(s => s.id === e.postId && (!handle || s.handle.toLowerCase() === handle.toLowerCase()));
    requireValue(s, '研究引用了未输入的帖子或其他作者');
    const quote = text(e.quote, 400).trim();
    requireValue(quote.length >= 6 && s.text.includes(quote) && !quote.includes('[中间内容省略]'), '研究引用的原句不在该作者的输入文字里，本次报告未保存');
    return { postId: s.id, quote };
  });
}
export function validateStudy(result, bundle) {
  requireValue(Array.isArray(result.profiles) && result.profiles.length === bundle.authors.length, '研究报告没有覆盖全部所选博主');
  const seen = new Set();
  const profiles = result.profiles.map(p => {
    const a = bundle.authors.find(a => a.handle.toLowerCase() === String(p.handle).toLowerCase());
    requireValue(a && !seen.has(a.handle), '研究报告的作者重复或不存在'); seen.add(a.handle);
    requireValue(Array.isArray(p.insights) && p.insights.length >= 4 && p.insights.length <= 8, '每位博主需要 4—8 条有证据的研究结论');
    const insights = p.insights.map((i, n) => {
      requireValue(['audience', 'style', 'structure', 'method', 'operation', 'comparison'].includes(i.dimension), '研究维度格式不正确');
      requireValue(['low', 'medium', 'high'].includes(i.confidence), '研究把握度格式不正确');
      return { id: a.handle.toLowerCase() + '-' + (n + 1), dimension: i.dimension, title: text(i.title, 200), observation: text(i.observation, 1800), interpretation: text(i.interpretation, 1800), adaptation: text(i.adaptation, 1800), confidence: i.confidence, evidence: evidence(i.evidence, bundle, a.handle) };
    });
    requireValue(['style', 'structure', 'method', 'operation'].every(k => insights.some(i => i.dimension === k)), '报告缺少表达、结构、方法或运营维度');
    return { handle: a.handle, name: a.name, insights };
  });
  const comparisons = (result.comparisons || []).map(i => ({ title: text(i.title, 200), observation: text(i.observation, 2000), adaptation: text(i.adaptation, 2000), evidence: evidence(i.evidence, bundle) }));
  requireValue(comparisons.length <= 4, '跨博主比较最多 4 项');
  return { profiles, comparisons };
}
export const STUDY_PROMPT = `执行爆款创作研究。依据真实样本研究 AI 知识型 X 博主。methods 是诊断方法，禁止用其中案例或模型记忆补这些作者事实。sample.text 只有作者自己的文字；quoteContext 仅提示归属，禁止拿被引用作者内容归因。排名只代表已取得的同一作者样本；有高位和中低位时做具体差异比较，不能推出因果或保证流量。研究表达风格、开头、结构、选题方法、可见运营线索；运营必须分清可见动作与待验证假设，不猜收入/涨粉/幕后安排。每条观察需真实postId及从其text逐字摘录的6—120字原句。不要把标题引号、省略标记或自己改写当原句。每人先输出4—5条精练insights，每项一条核心结论、1—3条evidence，必须含style、structure、method、operation，可加audience和comparison。interpretation明确是文本推断及边界；adaptation写用户如何用通用方法创造自己的内容。返回JSON：{"profiles":[{"handle":"输入handle","insights":[{"dimension":"style","title":"结论标题","observation":"可直接观察的文字特征","interpretation":"机制推断与限制","adaptation":"用户可以采取的具体做法","confidence":"medium","evidence":[{"postId":"输入的完整字符串id","quote":"逐字原句"}]}]}],"comparisons":[{"title":"跨作者比较","observation":"差异","adaptation":"如何选用","evidence":[{"postId":"真实id","quote":"原句"}]}]}。comparisons最多2条，每项1—4条evidence，任何evidence不得为空。不返回无证据的概括性作者介绍。`;
export const CREATION_PROMPT = `执行爆款创作写作。面向普通人的AI热点、工具和玩法，写一篇800—1500个Unicode字符（含标点）的中文X中长文单帖，建议1000—1200字符。study仅用来借鉴通用方法，不是本帖事实来源。所有外部事实只能来自materials，材料只代表当前取得的文字，图片和视频没有被分析；描述缺口必须写「当前取得的文字未说明」，不能断言原帖、图片、视频或完整串文没有展示某信息。不要写焦虑减半、效率翻倍等无材料支持的量化效果。保留归属，不把博主个人声明当用户亲测，不增加未给出的时点、版本、价格、数字、能力或个人经历。ownAngle是用户观点，ownMaterial是用户补充的材料，均非独立核实；资料缺口写verificationNotes。可以没有第一人称。禁止复制参考帖标志性口头禅或成段文字，不冒充参考博主。正文应清楚具体，避免模板化命令、空洞煽动和流量保证。输出2—3个不同标题、完整正文（选一个标题放首行）、可编辑提纲、借鉴方法及应用说明、1—6条事实依据（逐字引用对应材料quote）、核实提醒和2—3张原创示意图提示词。图片用于ChatGPT网页生成，简体中文、手机可读，不伪造截图和实测数据。返回JSON：{"titles":["标题一","标题二"],"body":"完整正文","outline":"开头\\n正文\\n结尾","methodsUsed":[{"insightId":"study中真实insight.id","application":"用了哪个通用方法，如何转成自己的内容"}],"sourceNotes":[{"materialId":"materials真实id","quote":"该material.text内逐字原句","use":"正文用到的事实或归属"}],"verificationNotes":["待核实项或材料限制"],"images":[{"title":"图片主题","prompt":"可直接复制到ChatGPT的完整画面要求"}]}。`;
export function validateCreation(result, materials, study) {
  const body = text(result.body, 10000).trim(); const length = [...body].length;
  requireValue(length >= 800 && length <= 1500, `正文为 ${length} 字符，需要 800—1500 字符，本次未覆盖旧稿`);
  const titles = strings(result.titles, 2, 3, '备选标题'), outline = text(result.outline, 6000).trim(); requireValue(outline, '提纲不能为空');
  requireValue(Array.isArray(result.methodsUsed) && result.methodsUsed.length >= 1 && result.methodsUsed.length <= 5, '请说明借鉴的通用方法');
  const insights = study.profiles.flatMap(p => p.insights);
  const methodsUsed = result.methodsUsed.map(i => { requireValue(insights.some(s => s.id === i.insightId), '写作引用了不存在的研究方法'); return { insightId: i.insightId, application: text(i.application, 2000) }; });
  requireValue(Array.isArray(result.sourceNotes) && result.sourceNotes.length >= 1 && result.sourceNotes.length <= 6, '正文需要真实材料依据');
  const sourceNotes = result.sourceNotes.map(n => { const m = materials.find(m => m.id === n.materialId); const quote = text(n.quote, 600).trim(); requireValue(m && quote.length >= 6 && m.text.includes(quote), '正文引用了不存在的材料或原句，本次草稿未保存'); return { materialId: m.id, quote, use: text(n.use, 2000) }; });
  const verificationNotes = strings(result.verificationNotes || [], 0, 12, '核实提醒');
  requireValue(Array.isArray(result.images) && result.images.length >= 2 && result.images.length <= 3, '需要 2—3 张原创配图提示词');
  const images = result.images.map(i => ({ title: text(i.title, 200), prompt: text(i.prompt, 5000) }));
  const overlaps = [];
  // A literal overlap check only; it cannot certify originality or detect AI authorship.
  for (const s of study.samples) {
    for (let n = 0; n <= s.text.length - 40; n += 10) { const part = s.text.slice(n, n + 40); if (body.includes(part)) { overlaps.push({ postId: s.id, quote: part }); break; } }
  }
  return { titles, body, outline, methodsUsed, sourceNotes, verificationNotes, images, overlaps, bodyHash: hash(body), imagesBodyHash: hash(body) };
}
export function viralProject(draft) {
  const sources = draft.materials.filter(m => m.url).map(m => ({ id: m.id, source: m.name, url: m.url, summary: m.text, publishedAt: m.publishedAt, fetchedAt: m.fetchedAt, sourceKind: 'x' }));
  const card = { id: id(), title: draft.titles[0], type: 'practice', eventKey: 'viral-' + draft.id, reason: '由爆款创作生成的原创参考稿，来源尚需核实', summary: draft.topic, angles: [draft.ownAngle, '先讲读者的问题，再讲方法与限制'], outline: draft.outline, needsTest: false, testSteps: [], facts: draft.sourceNotes.map(n => n.use), unknowns: draft.verificationNotes, sources };
  return { id: id(), viralDraftId: draft.id, card, title: card.title, angle: draft.ownAngle, outline: draft.outline, outlineApproved: false, draft: draft.body, draftApproved: false, versions: [{ id: id(), body: draft.body, at: now() }], plan: null, planApproved: false, suggestedImages: draft.images.map(i => ({ kind: 'illustration', title: i.title, description: '爆款创作提供的原创示意配图', prompt: i.prompt, points: [] })), suggestedImagesBodyHash: draft.imagesBodyHash || hash(draft.versions[0]?.body || draft.body), testNotes: '', testApproved: false, evidence: draft.materials.map(m => ({ material: m.text, url: m.url || '', fetchedAt: m.fetchedAt, notice: '爆款创作原始材料，事实仍需核实' })), assets: [], startedAt: now(), stage: 'outline', importedDraftPending: true, warnings: draft.verificationNotes };
}
