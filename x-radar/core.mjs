import { createHash, randomUUID } from 'node:crypto';
export const now = () => new Date().toISOString();
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const id = () => randomUUID();
export function requireValue(ok, message) { if (!ok) throw new Error(message); }
export function text(value, max = 30000) { requireValue(typeof value === 'string' && value.length <= max, `文字不能为空或超过 ${max} 字符`); return value; }
export function parseJSON(content) {
  requireValue(typeof content === 'string', '模型没有返回文字');
  const clean = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(clean); } catch { throw new Error('模型结果不是合法 JSON，本次结果未用于推进流程。请检查模型兼容性后重试。'); }
}
const list = (v, min, max, label) => { requireValue(Array.isArray(v) && v.length >= min && v.length <= max && v.every(s => typeof s === 'string' && s.trim() && s.length <= 3000), `模型返回的${label}格式不正确`); return v; };
export function validateCards(result, candidates, history = [], requireAssessment = false) {
  requireValue(Array.isArray(result.cards) && result.cards.length <= 5, '推荐结果必须为最多 5 个选题');
  const seen = new Set();
  return result.cards.map(c => {
    const candidateIds = list(c.candidateIds, 1, 6, '信源引用');
    const sources = candidateIds.map(key => candidates.find(s => s.id === key));
    requireValue(sources.every(Boolean), '模型引用了输入中不存在的来源');
    const eventKey = text(c.eventKey, 200).trim().toLowerCase();
    requireValue(eventKey && !seen.has(eventKey), '同一批推荐存在重复事件'); seen.add(eventKey);
    const prior = history.find(h => h.eventKey === eventKey || h.sources?.some(s => candidateIds.includes(s.id)));
    if (prior) requireValue(c.newProgress?.trim() && sources.some(s => !prior.sources.some(old => old.fingerprint === s.fingerprint)), '重复事件没有实质新进展，未生成当日精选');
    requireValue(['hot', 'practice'].includes(c.type), '选题类型不正确');
    let assessment = null;
    if (requireAssessment || c.assessment) {
      requireValue(c.assessment && typeof c.assessment === 'object', '模型未提供选题判断依据');
      const a = c.assessment;
      assessment = Object.fromEntries(['audience', 'readerBenefit', 'angleBasis', 'materialGap'].map(k => [k, text(a[k], 1500).trim()]));
      requireValue(Object.values(assessment).every(Boolean), '选题判断依据不能为空');
      requireValue(['low', 'medium', 'high'].includes(a.confidence), '选题判断把握格式不正确');
      assessment.confidence = a.confidence;
    }
    const outline = Array.isArray(c.outline) && c.outline.every(s => typeof s === 'string') ? c.outline.join('\n') : c.outline;
    return { id: id(), title: text(c.title, 250), eventKey, type: c.type, reason: text(c.reason, 2000), summary: text(c.summary, 4000), angles: list(c.angles, 2, 3, '写作角度'), outline: text(outline, 6000), needsTest: c.needsTest === true, testSteps: list(c.testSteps || [], 0, 12, '实测步骤'), facts: list(c.facts || [], 0, 15, '事实'), unknowns: list(c.unknowns || [], 0, 15, '待核实项'), newProgress: text(c.newProgress || '', 3000), assessment, sources, createdAt: now() };
  });
}
export function validatePlan(result) {
  requireValue(Array.isArray(result.images) && result.images.length > 0 && result.images.length <= 6, '配图方案需要 1—6 张图片');
  return result.images.map(i => {
    requireValue(['screenshot', 'infographic', 'illustration'].includes(i.kind), '配图类型不正确');
    const points = list(i.points || [], 0, 7, '图示要点'); requireValue(points.every(p => [...p].length <= 160), '每个信息图要点请控制在 160 字内');
    return { id: id(), kind: i.kind, title: text(i.title, 200), description: text(i.description, 4000), prompt: text(i.prompt || '', 5000), points };
  });
}
export function approveOutline(project, input) {
  const outline = text(input.outline, 10000).trim(); const angle = text(input.angle, 3000).trim();
  requireValue(outline && angle, '请先填写写作角度和提纲');
  const changed = angle !== project.angle || outline !== project.outline;
  return { ...project, angle, outline, outlineApproved: true, draft: '', draftApproved: false, plan: null, planApproved: false, testApproved: changed ? false : project.testApproved, completedAt: null, stage: project.card.needsTest && (changed || !project.testApproved) ? 'testing' : 'draft', selectedAt: project.selectedAt || now(), selectionMinutes: project.selectionMinutes ?? Math.round((Date.now() - new Date(project.startedAt).getTime()) / 600) / 100 };
}
export function saveDraft(project, draft) {
  draft = text(draft, 30000);
  if (draft === project.draft) return project;
  return { ...project, draft, draftApproved: false, planApproved: false, plan: null, review: null, completedAt: null, stage: 'draft', versions: [...project.versions, { id: id(), body: draft, at: now() }] };
}
export function draftLength(body) {
  const count = [...body].length;
  return { count, min: 800, max: 1500, status: count < 800 ? 'short' : count > 1500 ? 'long' : 'within' };
}
export function saveGeneratedDraft(project, result, kind = 'initial') {
  requireValue(typeof result?.body === 'string', '模型没有返回可用正文，本次保留已有内容');
  const body = text(result.body, 30000).trim();
  requireValue(body, '模型返回了空正文，本次保留已有内容');
  const next = saveDraft(project, body);
  return { ...next, draftGeneration: { ...draftLength(body), kind, at: now() },
    warnings: Array.isArray(result.warnings) ? result.warnings.filter(w => typeof w === 'string' && w.trim()).map(w => w.slice(0, 2000)).slice(0, 12) : [] };
}
export function validateReview(result, draft) {
  const summary = text(result.summary, 2000).trim(); requireValue(summary, '审稿摘要不能为空');
  requireValue(Array.isArray(result.issues) && result.issues.length <= 8, '审稿问题需为最多八项');
  const issues = result.issues.map(i => {
    const quote = text(i.quote, 1500).trim(); requireValue(quote && draft.includes(quote), '审稿引用了正文中不存在的句子，本次结果未保存');
    return { quote, problem: text(i.problem, 2000), suggestion: text(i.suggestion, 2000) };
  });
  return { summary, audience: text(result.audience, 1500), readerBenefit: text(result.readerBenefit, 1500), issues, draftHash: hash(draft), createdAt: now() };
}
export function gateDraft(project) {
  requireValue(project.outlineApproved, '请先确认角度与提纲');
  requireValue(!project.card.needsTest || project.testApproved, '请先完成实测并确认结果');
}
export function gateImages(project) {
  requireValue(project.draftApproved && project.planApproved && project.planHash === hash(project.draft), '请先确认当前正文及其配图方案');
}
export function svgCard(plan, sourceNote = '示意图 · 根据确认稿整理') {
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
  const lines = s => [...String(s)].reduce((a, ch, i) => { const n = Math.floor(i / 27); a[n] = (a[n] || '') + ch; return a; }, []);
  const points = plan.points.length ? plan.points : [[...plan.description].slice(0, 160).join('')];
  const titles = [...String(plan.title)].reduce((a, ch, i) => { const n = Math.floor(i / 23); a[n] = (a[n] || '') + ch; return a; }, []);
  let y = 270 + Math.max(0, titles.length - 1) * 58; let body = '';
  for (let n = 0; n < Math.min(points.length, 7); n++) {
    body += `<text x="88" y="${y}" fill="#a6f28f" font-size="23">${String(n + 1).padStart(2, '0')}</text>`;
    for (const line of lines(points[n])) { body += `<text x="152" y="${y}" fill="#f2f5ef" font-size="29">${esc(line)}</text>`; y += 46; }
    y += 28;
  }
  const h = Math.max(780, y + 140);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${h}" viewBox="0 0 1200 ${h}"><rect width="1200" height="${h}" rx="28" fill="#17251e"/><path d="M88 93h60" stroke="#a6f28f" stroke-width="7"/><g font-family="Microsoft YaHei, Noto Sans SC, sans-serif">${titles.map((title, n) => `<text x="88" y="${158 + n * 58}" fill="#f2f5ef" font-size="44" font-weight="bold">${esc(title)}</text>`).join('')}${body}<text x="88" y="${h - 55}" fill="#a7b7ac" font-size="20">${esc(sourceNote)}</text></g></svg>`;
}
