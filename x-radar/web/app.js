import { xPage, xReader } from './x-source-view.js';
import { viralPage, initialViralForm, initializeViralForm, persistViralForm } from './viral-view.js';
import { growthPage, initialGrowthForm, initializeGrowthForm, persistGrowthForm } from './growth-view.js';
const growthForm = initialGrowthForm();
const viralForm = initialViralForm();
let viralQueryTimer;
const views = ['daily', 'x', 'viral', 'growth', 'search', 'projects', 'project', 'settings', 'costs', 'skills'];
const hashView = location.hash.slice(1);
let state, view = views.includes(hashView) ? hashView : sessionStorage.getItem('radar-view') || 'daily', projectId = sessionStorage.getItem('radar-project'), searchResult = null, busy = false;
if (!views.includes(view)) view = 'daily';
let busyMessage = '', xOpened = null, xManageOpen = false, xQueryTimer;
const xFilters = { account: 'all', type: 'all', range: '7', sort: 'latest', query: '', limit: 24 };
let browseStarted = new Date().toISOString();
const $ = selector => document.querySelector(selector);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = v => v ? new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '原始发布时间未知';
const link = (url, label) => { try { const u = new URL(url); return u.protocol === 'https:' ? `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label); } catch { return esc(label); } };
const labels = { outline: '角度与提纲', testing: '待实测', draft: '正文初稿', plan: '配图方案', images: '制作配图', done: '完成' };
const kindLabels = { screenshot: '真实截图', infographic: '信息图', illustration: '原创示意插图' };
function illustrationPrompt(i) { return `请为一篇面向普通读者的中文 AI 图文帖子制作一张原创示意插图。\n主题：${i.title}\n用途：${i.description}\n画面要求：${i.prompt || i.description}\n图片用于 X 帖子，主体清楚、便于手机阅读。图中文字使用简体中文，尽量简短。\n不得伪造真实产品截图、测试结果、统计数字、引用或亲测证据。`; }
function imagePlanItem(p, i) {
  const asset = p.assets.find(a => a.planId === i.id && a.draftHash);
  let controls = asset ? `<div class="gallery"><div><img src="/assets/${asset.file}" alt="${esc(asset.label)}"><p>${linkLocal(asset)}</p></div></div>` : '';
  if (i.kind === 'illustration') {
    if (!asset && state.settings.imageMode === 'api') controls += `<p class="muted">使用图片 API：${esc(state.settings.imageModel)}，生成后会自动保存到这份稿件。</p>${state.settings.imageCheck?.status === 'failed' ? notice(esc(state.settings.imageCheck.message), 'warn') : ''}<div class="actions">${button('使用图片 API 生成', 'image', `data-id="${i.id}"`, true)}</div>`;
    controls += `<details ${!asset && state.settings.imageMode !== 'api' ? 'open' : ''}><summary>${state.settings.imageMode === 'api' ? '手动导入或替换插图' : '在 ChatGPT 生成后导入'}${asset ? ' · 可替换这张图' : ''}</summary><p class="muted">复制提示词 → 打开 ChatGPT 生成图片 → 下载到电脑 → 在这里导入。使用你已有的 Plus，无需填写图片 API 密钥。</p><label>配图提示词<textarea readonly rows="6">${esc(illustrationPrompt(i))}</textarea></label><div class="actions">${button('复制配图提示词', 'copy-prompt', `data-id="${i.id}"`)}<a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">打开 ChatGPT ↗</a></div><label>选择生成的图片（PNG / JPG / WebP，最多 10MB）<input type="file" id="upload-${i.id}" accept="image/png,image/jpeg,image/webp"></label>${button(asset ? '替换这张插图' : '导入这张插图', 'upload-plan', `data-id="${i.id}"`, true)}</details>`;
  } else if (!asset) controls += i.kind === 'screenshot' ? `<label>选择真实截图<input type="file" id="upload-${i.id}" accept="image/png,image/jpeg,image/webp"></label>${button('上传这张截图', 'upload-plan', `data-id="${i.id}"`)}` : button('制作信息图', 'image', `data-id="${i.id}"`, true);
  return `<div class="planitem"><span class="tag">${kindLabels[i.kind]}${asset?.origin === 'api' ? ' · API 已生成' : asset?.origin === 'import' && i.kind === 'illustration' ? ' · 已导入' : ''}</span><h3>${esc(i.title)}</h3><p class="muted">${esc(i.description)}</p>${controls}</div>`;
}
const notice = (body, kind = '') => `<div class="notice ${kind}">${body}</div>`;
function toast(message) { const t = $('#toast'); t.textContent = message; t.classList.add('visible'); setTimeout(() => t.classList.remove('visible'), 5500); }
async function api(route, data) { const r = await fetch(route, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const d = await r.json(); if (!r.ok) throw Error(d.error || '请求失败'); return d; }
async function reload() { state = await api('/api/state'); initializeViralForm(state, viralForm); initializeGrowthForm(state, growthForm); }
async function task(route, data = {}) {
  const previousHTML = $('#app').innerHTML;
  const edits = [...document.querySelectorAll('input[id],textarea[id],select[id]')].filter(e => e.type !== 'file').map(e => [e.id, e.value, e.checked]); let succeeded = false, refreshFailure = false;
  busyMessage = route === '/api/growth/use-study' ? '正在载入已保存的拆解，无需调用模型。' : route.startsWith('/api/x/') && route !== '/api/x/topic' || route === '/api/collect' ? '正在读取公开来源，无需调用写作模型。本机服务会继续处理。' : '正在处理，本机服务会继续执行。模型生成可能需要几分钟。';
  busy = true; render();
  try {
    let result = await api(route, data);
    if (result.status === 'running') {
      while (result.status === 'running') { if (result.message) { busyMessage = result.message; const progress = $('#progress-message'); if (progress) progress.textContent = busyMessage; } await new Promise(r => setTimeout(r, 1200)); result = await api('/api/job/' + result.id); }
      if (result.status === 'error') throw Error(result.error);
      result = result.result;
    }
    await reload(); succeeded = true; return result;
  } catch (e) {
    if (route === '/api/image/test' || route === '/api/image' || route.startsWith('/api/viral/images')) { try { await reload(); refreshFailure = true; } catch { /* Preserve inputs if the local service is unavailable. */ } }
    throw e;
  } finally { busy = false; render(); if (!succeeded) { if (!refreshFailure) $('#app').innerHTML = previousHTML; for (const [key, value, checked] of edits) { const el = document.getElementById(key); if (el) { el.value = value; if (el.type === 'checkbox') el.checked = checked; } } } }
}
function button(label, action, extra = '', primary = false) { return `<button ${busy ? 'disabled' : ''} data-action="${action}" ${extra} class="${primary ? 'primary' : ''}">${label}</button>`; }
function field(label, name, value = '', opts = {}) { return `<label>${label}${opts.area ? `<textarea id="${name}" rows="${opts.rows || 4}" ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''}>${esc(value)}</textarea>` : `<input id="${name}" value="${esc(value)}" type="${opts.type || 'text'}" ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''}>`}</label>`; }
function sources(card, read = false) { return card.sources.map(s => `<div class="source">${link(s.url, s.source || '原文')} · ${esc(date(s.publishedAt))}${s.attribution ? ' · ' + link(s.attribution, 'AIHOT 收录') : ''}${read ? ' ' + button('读取原文', 'source', `data-url="${esc(s.url)}"`) : ''}</div>`).join(''); }
function assessmentHTML(a) { return a ? `<details class="assessment"><summary>查看选题判断依据</summary><p><strong>谁会关心：</strong>${esc(a.audience)}</p><p><strong>读者得到：</strong>${esc(a.readerBenefit)}</p><p><strong>角度依据：</strong>${esc(a.angleBasis)}</p><p><strong>材料缺口：</strong>${esc(a.materialGap)}</p><small class="muted">把握度：${esc(a.confidence)}（未校准的主观判断，不代表事实核实）</small></details>` : notice('此选题由旧版本生成，未记录判断依据；请以原文和材料为准。', 'warn'); }
function methodsHTML(methods = state.methods) { if (!methods) return ''; return `<div class="method-note"><strong>选题判断已启用</strong><span>依据：${methods.packages?.map(p => esc(p.name)).join('、') || '已安装方法'}。它们只帮助检查受众、阅读收益、材料依据和表达问题，不预测阅读量。</span></div>`; }
function reviewHTML(r) { if (!r) return ''; return `<div class="review-report" id="review-report"><div class="sectionhead"><h3>内容审稿</h3><span class="tag">只诊断，不改写</span></div><p><strong>摘要：</strong>${esc(r.summary)}</p><p><strong>目标读者：</strong>${esc(r.audience)}</p><p><strong>读者收益：</strong>${esc(r.readerBenefit)}</p>${r.issues?.length ? `<ol>${r.issues.map(i => `<li><blockquote>${esc(i.quote)}</blockquote><strong>问题：</strong>${esc(i.problem)}<br><strong>建议：</strong>${esc(i.suggestion)}</li>`).join('')}</ol>` : '<p class="muted">没有发现需要优先处理的原句问题。</p>'}<small class="muted">报告绑定当前正文版本，正文修改后会自动失效。</small></div>`; }
function cards(items) { return `<div class="grid">${items.map((c, i) => `<article class="card"><div class="cardhead"><span class="tag ${c.type}">${c.type === 'hot' ? '及时热点' : '工具与玩法'}</span><span class="number">${String(i + 1).padStart(2, '0')}</span></div><h3>${esc(c.title)}</h3><p class="muted">${esc(c.summary)}</p><div class="reason">${esc(c.reason)}</div>${assessmentHTML(c.assessment)}${c.newProgress ? notice('新进展：' + esc(c.newProgress)) : ''}<details><summary>查看 ${c.angles.length} 个写作角度与建议提纲</summary><ul>${c.angles.map(a => `<li>${esc(a)}</li>`).join('')}</ul><div class="pre">${esc(c.outline)}</div></details>${c.needsTest ? '<span class="tag">需要你实测</span>' : ''}${sources(c)}<div class="actions">${button('选择这个选题 →', 'select', `data-id="${c.id}"`, true)}</div></article>`).join('')}</div>`; }
function stats() {
  const weekAgo = Date.now() - 7 * 86400000; const completed = state.projects.filter(p => p.stage === 'done' && p.completedAt && Date.parse(p.completedAt) >= weekAgo);
  const timed = state.projects.filter(p => p.selectionMinutes !== undefined && Date.parse(p.selectedAt) >= weekAgo);
  const avg = timed.length ? (timed.reduce((n, p) => n + p.selectionMinutes, 0) / timed.length).toFixed(1) : '—';
  return `<div class="stats"><div class="stat"><strong>${state.daily?.cards.length ?? '—'}</strong><small>今日选题 · 最多 5 个</small></div><div class="stat"><strong>${completed.length}<small> / 3</small></strong><small>近 7 天完成图文 · 目标 3 篇</small></div><div class="stat"><strong>${avg}<small> 分钟</small></strong><small>近 7 天平均选题耗时 · 目标 ≤15</small></div></div>`;
}
function sourceStatus(reports = []) {
  if (reports === state.daily?.reports && state.pool && Date.parse(state.pool.fetchedAt) > Date.parse(state.daily.generatedAt)) return `<div class="notice"><p>信源材料已更新。当前精选仍是 ${esc(date(state.daily.generatedAt))} 保存的版本，可用新材料重新筛选。</p>${button('用当前信源重新筛选', 'recommend-refresh')}</div>` + sourceStatus(state.pool.reports);
  return reports.length ? `<p class="muted">${reports.map(r => r.ok ? `${esc(r.name)}：${r.count} 条${r.partial ? '（部分取得：' + esc(r.error) + '）' : ''}` : `<span class="url">${esc(r.name)}失败：${esc(r.error)}${r.cached ? '；使用上次缓存，采集时间：' + esc(date(r.fetchedAt)) : ''}</span>`).join('　/　')}</p>` : '';
}
function dailyPage() {
  const configured = state.settings.hasTextKey && state.settings.textBase && state.settings.textModel;
  return `<div class="hero"><div><div class="eyebrow">Your daily editorial radar</div><h1>从信息，到值得写的选题。</h1><p>面向普通人的 AI 热点、工具与玩法。少一点浏览，多一点自己的角度。</p></div>${button(state.daily ? '查看今日精选' : '生成今日精选', 'recommend', '', true)}</div>${methodsHTML()}${!configured ? notice('<strong>先接通写作能力</strong><p>可以先浏览真实资讯。配置模型后，再生成精选、提纲和正文。</p>' + button('打开模型与风格设置', 'nav', 'data-view="settings"'), 'warn') : ''}${stats()}${sourceStatus(state.daily?.reports || state.pool?.reports)}<div class="sectionhead"><h2>今日精选</h2><span class="pill">${state.date} · 北京时间</span></div>${state.daily ? state.daily.cards.length ? cards(state.daily.cards) : `<div class="empty"><h3>今天没有需要新增的选题</h3><p>当前材料没有达到推荐标准，或与此前推荐重复。你可以查询主题或提交自己的材料。</p>${button('去查询主题', 'nav', 'data-view="search"')}</div>` : `<div class="empty"><h3>先发现，再决定怎么讲</h3><p>${configured ? '生成后会显示推荐理由、2—3 个写作角度和建议提纲。' : '尚未生成 AI 精选；下方资讯是来源材料，未经账号适配筛选。'}</p>${button('读取最新资讯', 'collect')}${configured ? ' ' + button('生成今日精选', 'recommend', '', true) : ''}</div>`}${state.pool?.items.length ? `<div class="sectionhead"><h2>信源材料</h2><span class="muted">${date(state.pool.fetchedAt)}读取 · 非 AI 推荐</span></div><div class="panel">${state.pool.items.slice(0, 15).map(i => `<div class="projectrow"><div><h3>${link(i.url, i.title)}</h3><p class="muted">${esc(i.summary.slice(0, 180))}</p><small>${esc(i.source)} · ${esc(date(i.publishedAt))}</small></div></div>`).join('')}</div>` : ''}`;
}
function searchPage() {
  const results = searchResult || state.searches[0];
  return `<div class="hero"><div><div class="eyebrow">Follow your curiosity</div><h1>从一个主题，或一个想法开始。</h1><p>查找近期线索，也可以贴入文章、帖子链接或文字材料。</p></div></div><div class="querybox"><label for="query">你想写什么？</label><div class="row"><input id="query" placeholder="例如：AI 视频、图片编辑、普通人的 AI 办公"><button data-action="search" class="primary" ${busy ? 'disabled' : ''}>查找选题</button></div><details><summary>我已经有链接或文字材料</summary>${field('原文链接（可留空）', 'material-url', '', { placeholder: 'https://…' })}${field('文字材料或想法', 'material-text', '', { area: true, placeholder: '贴入可核实的材料；个人想法会与事实分开处理。' })}${button('整理材料并提出角度', 'material', '', true)}</details></div>${results ? `<div class="sectionhead"><h2>${esc(results.query || '查询结果')}</h2><small class="muted">${date(results.generatedAt)}</small></div>${sourceStatus(results.reports)}${results.cards.length ? cards(results.cards) : notice('没有找到合适的新选题。可以更换主题或补充材料。')}` : ''}`;
}
function projectsPage() { return `<div class="hero"><div><div class="eyebrow">Your writing desk</div><h1>继续你的图文创作。</h1><p>每一步、每个版本和每张图片，都保存在本机。</p></div></div>${stats()}<div class="panel">${state.projects.length ? state.projects.map(p => `<div class="projectrow"><div><h3>${esc(p.title)}</h3><small class="muted">${labels[p.stage]} · ${date(p.updatedAt)}${p.selectionMinutes !== undefined ? ` · 选题 ${p.selectionMinutes} 分钟` : ''}</small></div>${button('继续 →', 'open', `data-id="${p.id}"`)}</div>`).join('') : `<div class="empty"><h3>还没有开始的稿件</h3><p>从今日精选或主题查询中选择一个选题。</p>${button('去看选题', 'nav', 'data-view="daily"', true)}</div>`}</div>`; }
function skillsPage() {
  const packages = state.methods?.packages || [];
  const descriptions = {
    'cheat-on-content': '保留选题理由、来源和方法版本，区分未校准判断与真实发布数据。完整盲预测和复盘暂未自动执行。',
    'dbs': '内容方法总入口；本工作台按 X 图文场景调用相关子技能。',
    'dbs-content': '检查核心问题、结构、证据、案例和行动是否服务于读者。',
    'dbs-content-value': '检查谁会关心、开头承诺什么、读者读完得到什么。',
    'dbs-resonate': '对正文做原句级共鸣诊断，给出可执行修改建议。',
    'dbs-spread': '解释内容为什么可能引发共鸣、讨论或分享。',
    'dbs-ai-check': '诊断机器化表达；不判断作者身份，也不承诺通过检测。'
  };
  return `<div class="hero"><div><div class="eyebrow">Connected content methods</div><h1>已接入技能</h1><p>这里列出实际安装并参与工作台流程的技能。它们只提供内容判断和诊断方法，不会替你发布到 X。</p></div></div>${packages.map(p => `<div class="panel skill-package"><div class="sectionhead"><div><h2>${esc(p.name)}</h2><p class="muted">${esc(p.url)}</p></div><span class="tag">${p.enabled ? '已启用' : '文件缺失'}</span></div><p><strong>版本：</strong><code>${esc(p.commit.slice(0, 12))}</code>　<strong>许可：</strong>${esc(p.license)}</p><div class="skill-grid">${p.skills.map(name => `<div class="skill-entry"><strong>${esc(name)}</strong><small>${esc(descriptions[name] || '已安装入口，可按需调用。')}</small></div>`).join('')}</div></div>`).join('')}<div class="panel"><h3>当前网页中的生效位置</h3><ol><li>今日雷达：生成选题时检查受众、阅读收益、材料依据和证据缺口。</li><li>爆款创作：用真实帖子拆解表达、结构、内容方法和运营线索，每条结论附原句证据；写作单独使用事实材料。</li><li>X 起号：单篇结构拆解、原创图文和本机复盘；新研究的方法与版本见「项目与 Skills」。</li><li>我的稿件：生成正文后可以运行原句级内容审稿。</li><li>模型与风格：显示接入状态、版本和许可。</li></ol><p class="muted">当前不输出阅读量预测，也不把模型主观判断称为已校准数据。</p></div>`;
}
function projectPage() {
  const p = state.projects.find(p => p.id === projectId); if (!p) return projectsPage();
  const phases = ['outline', ...(p.card.needsTest ? ['testing'] : []), 'draft', 'plan', 'images', 'done']; const current = phases.indexOf(p.stage);
  const common = `<div class="actions">${button('← 全部稿件', 'nav', 'data-view="projects"')}<span class="pill">${labels[p.stage]}</span></div><h1 class="projecttitle">${esc(p.title)}</h1><div class="steps">${phases.map((s, i) => `<span class="step ${i === current ? 'current' : i < current ? 'done' : ''}">${i + 1}. ${labels[s]}</span>`).join('')}</div>`;
  const evidence = `<aside><div class="panel"><h3>事实与来源</h3>${sources(p.card, true)}<div class="divider"></div><ul>${p.card.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>${p.card.unknowns.length ? notice('<strong>尚待核实</strong><ul>' + p.card.unknowns.map(f => `<li>${esc(f)}</li>`).join('') + '</ul>', 'warn') : ''}<details><summary>补充原文或证据</summary>${field('材料文字', 'evidence-text', '', { area: true })}${button('保存补充材料', 'evidence')}</details>${p.evidence.length ? `<details><summary>已保存 ${p.evidence.length} 份材料</summary>${p.evidence.map(e => `<p class="source">${esc(e.notice)} · ${date(e.fetchedAt)}</p><p class="pre muted">${esc(e.material.slice(0, 1600))}</p>`).join('')}</details>` : ''}</div><div class="panel"><h3>写作提醒</h3><p class="muted">事实与个人观点分开。未实测时不写“亲测”，示意图不作为产品效果证据。</p><p class="muted">正文变更后，需要重新确认配图方案。</p></div></aside>`;
  let body = '';
  if (p.stage === 'outline') body = `<div class="panel"><h2>先确定，你想讲什么。</h2><label>建议角度<select id="angle-select">${p.card.angles.map(a => `<option ${a === p.angle ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>${field('你的写作角度', 'angle', p.angle, { area: true, rows: 2 })}${field('提纲 · 可直接修改', 'outline', p.outline, { area: true, rows: 13 })}${button('确认角度与提纲 →', 'outline', '', true)}</div>`;
  if (p.stage === 'testing') body = `<div class="panel"><h2>用实测，补上关键证据。</h2><ol>${p.card.testSteps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>${field('实际测试步骤、观察结果与限制', 'test-notes', p.testNotes, { area: true, rows: 9 })}<label>上传真实截图（PNG / JPG / WebP）<input type="file" id="evidence-upload" accept="image/png,image/jpeg,image/webp"></label>${button('上传实测截图', 'upload-evidence')}<div class="divider"></div>${button('确认实测结果，进入写作 →', 'test', '', true)}</div>`;
  if (p.stage === 'draft') body = `<div class="panel"><div class="sectionhead"><h2>把角度写成一篇完整帖子。</h2><span class="pill">800—1500 字</span></div><div class="actions">${button(p.draft ? '重新生成初稿' : '生成正文初稿', 'draft', '', true)}${button('返回修改提纲', 'back-outline')}</div><div class="divider"></div>${p.warnings?.length ? notice(p.warnings.map(w => esc(w)).join('<br>'), 'warn') : ''}<label>正文<textarea class="editor" id="draft">${esc(p.draft)}</textarea></label><p class="muted"><span id="char-count">${[...p.draft].length}</span> 字符 · 修改后先保存，再确认</p><div class="actions">${button('保存正文版本', 'save-draft')}${p.draft ? button('做一次内容审稿', 'review') : ''}${button('确认正文，准备配图 →', 'approve-draft', '', true)}</div>${reviewHTML(p.review)}${p.versions.length ? `<details class="history"><summary>历史正文 · ${p.versions.length} 个版本</summary>${p.versions.slice().reverse().map(v => `<details><summary>${date(v.at)} · ${[...v.body].length} 字符</summary><p class="pre">${esc(v.body)}</p></details>`).join('')}</details>` : ''}</div>`;
  if (p.stage === 'plan') body = `<div class="panel"><h2>让图片补充正文。</h2><div class="actions">${button(p.plan ? '重新生成方案' : '生成配图方案', 'plan', '', true)}${button('修改正文', 'back-draft')}</div>${p.plan ? `<p class="muted">逐张修改用途与内容。信息图可直接制作；原创插图可复制提示词到 ChatGPT 生成后导入。</p>${p.plan.map((i, n) => `<div class="planitem"><h3>第 ${n + 1} 张</h3><label>配图类型<select id="plan-kind-${n}">${Object.entries(kindLabels).map(([k, v]) => `<option value="${k}" ${k === i.kind ? 'selected' : ''}>${v}</option>`).join('')}</select></label>${field('标题', 'plan-title-' + n, i.title)}${field('这张图要说明什么', 'plan-description-' + n, i.description, { area: true, rows: 3 })}${field('信息图要点（每行一条，最多 7 条）', 'plan-points-' + n, i.points.join('\n'), { area: true, rows: 4 })}${field('原创插图的画面描述（截图和信息图可留空）', 'plan-prompt-' + n, i.prompt, { area: true, rows: 3 })}</div>`).join('')}<div class="divider"></div><div class="actions">${button('保存方案修改', 'save-plan')}${button('确认方案，开始制作 →', 'approve-plan', '', true)}</div>` : ''}</div>`;
  if (p.stage === 'images' || p.stage === 'done') body = `<div class="panel"><h2>${p.stage === 'done' ? '图文已准备好。' : '逐张完成配图。'}</h2>${p.plan.map(i => imagePlanItem(p, i)).join('')}<div class="divider"></div><div class="actions">${button('复制正文', 'copy')}${button('下载正文', 'download-draft')}${p.stage !== 'done' ? button('图文完成，记录采用 ✓', 'complete', '', true) : '<span class="tag">已计入本周完成</span>'}${button('修改正文', 'back-draft')}${button('修改配图方案', 'back-plan')}</div><details><summary>查看最终正文</summary><p class="pre">${esc(p.draft)}</p></details></div>`;
  const assets = p.assets.filter(a => !a.planId);
  return common + `<div class="cols"><section>${body}${assets.length ? `<div class="panel"><h3>实测素材</h3><div class="gallery">${assets.map(a => `<div><img src="/assets/${a.file}" alt="${esc(a.label)}"><p class="source">${esc(a.label)}</p>${linkLocal(a)}</div>`).join('')}</div></div>` : ''}</section>${evidence}</div>`;
}
function linkLocal(a) { return `<a href="/assets/${a.file}?download=1" download>下载${a.kind === 'infographic' ? ' PNG 信息图' : '图片'}</a>`; }
function settingsPage() {
  const s = state.settings;
  const imageStatus = s.imageCheck ? `<div class="notice ${s.imageCheck.status === 'ready' ? '' : 'warn'}"><strong>${s.imageCheck.status === 'ready' ? '图片生成已验证' : '图片 API 尚未通过测试'}</strong><p>${esc(s.imageCheck.message)}</p><small>${esc(date(s.imageCheck.checkedAt))}</small></div>${s.imageCheck.previewFile ? `<div class="gallery"><div><img src="/assets/${esc(s.imageCheck.previewFile)}" alt="图片 API 测试图"><a href="/assets/${esc(s.imageCheck.previewFile)}?download=1" download>下载测试图</a></div></div>` : ''}` : '<p class="muted">尚未验证图片生成。保存配置后，可生成一张测试图。</p>';
  const methods = state.methods;
  const methodsPanel = methods ? `<div class="panel"><h2>内容方法已启用</h2><p class="muted">当前工作台把两个开源 skill 适配成三处检查：选题卡片说明谁会关心、读者得到什么、依据哪条材料；正文阶段可做原句审稿；历史数据仍未校准，因此不会伪装成阅读量预测。</p><div class="method-list">${(methods.packages || []).map(p => `<div><strong>${esc(p.name)}</strong><small>${esc(p.license)} · ${p.enabled ? '已启用' : '未找到文件'}</small></div>`).join('')}</div><p class="muted">完整的盲预测、复盘和 rubric 升级仍需单独初始化历史数据；本工作台不会把模型主观判断标成实绩预测。</p></div>` : '';
  return `<div class="hero"><div><div class="eyebrow">Made for your voice</div><h1>连接能力，保留你的表达。</h1><p>密钥只提交到本机服务。模型调用会把用于该步骤的材料发送给你配置的服务。</p></div></div>${methodsPanel}<div class="panel"><h2>写作模型</h2><p class="muted">填写服务商提供的基础地址、模型名称和密钥。服务地址可以带 /v1，也可以使用服务商支持的基础地址。</p><div class="fieldgrid">${field("写作服务地址", "textBase", s.textBase, { placeholder: "https://api.deepseek.com" })}${field("写作模型名称", "textModel", s.textModel)}${field(`写作密钥${s.hasTextKey ? " · 已保存，留空保留" : ""}`, "textKey", "", { type: "password" })}</div><div class="divider"></div><h3>原创插图的制作方式</h3><label>制作方式<select id="imageMode"><option value="manual" ${s.imageMode !== "api" ? "selected" : ""}>ChatGPT 网页生成后导入 · 使用现有 Plus</option><option value="api" ${s.imageMode === "api" ? "selected" : ""}>图片 API 自动生成 · 单独计费</option></select></label><p class="muted">${s.imageMode === 'api' ? 'API 方式：确认正文和配图方案后，点击「使用图片 API 生成」，图片会自动保存到稿件。' : '网页方式：确认配图方案后，复制提示词到 ChatGPT 出图，再导入对应位置。'}信息图仍可在本机直接制作。</p><details id="image-api-settings" ${s.imageMode === "api" ? "open" : ""}><summary>图片 API 设置（网页方式不需要）</summary><p class="muted">只有选择并保存 API 方式后，才会通过图片 API 生成原创插图。</p><div class="fieldgrid">${field("图片服务地址", "imageBase", s.imageBase, { placeholder: "https://api.openai.com/v1" })}${field("图片模型名称", "imageModel", s.imageModel)}${field(`图片密钥${s.hasImageKey ? " · 已保存，留空保留" : ""}`, "imageKey", "", { type: "password" })}</div>${imageStatus}<p class="muted">测试会实际生成一张图片，服务商可能计费；测试图单独保存，不会改变已有稿件。</p><div class="actions">${button("保存并生成测试图", "image-test")}</div></details><details><summary>费用估算（选填，不影响使用）</summary><p class="muted">只用于记账，不会改变服务商收费。留空时费用显示“未知”。币种仅标注估算单位，不会兑换货币。</p><div class="fieldgrid">${field("币种", "currency", s.currency)}${field("输入价格 / 百万 token（选填）", "inputPrice", s.inputPrice ?? "", { type: "number" })}${field("输出价格 / 百万 token（选填）", "outputPrice", s.outputPrice ?? "", { type: "number" })}${field("每张图片估算价格（选填）", "imagePrice", s.imagePrice ?? "", { type: "number" })}</div></details><div class="actions">${button("保存模型设置", "settings", "", true)}${button("保存并测试写作连接", "model-test")}</div><details><summary>移除已保存的密钥</summary><div class="actions">${button("移除写作密钥", "clear-text")}${button("移除图片密钥", "clear-image")}</div></details></div><div class="panel"><h2>你的写作风格</h2>${field('基础风格', 'tone', s.tone, { area: true, rows: 3 })}${field('3—5 篇代表性帖子文字', 'samples', s.samples, { area: true, rows: 9, placeholder: '把帖子文字贴在这里，篇与篇之间用空行分隔。' })}<div class="actions">${button('保存样本', 'save-samples')}${button('保存并提炼风格说明', 'style', '', true)}</div><div class="divider"></div>${field('风格说明 · 可自行修改', 'style', s.style, { area: true, rows: 5 })}<p class="muted">${s.styleApproved ? '✓ 已确认，写作会参考这份说明。' : '尚未确认：当前使用基础风格，不声称已匹配你的个人风格。'}</p>${button('确认这份风格说明', 'approve-style', '', true)}</div><div class="panel"><h2>少量一手来源</h2><p class="muted">AIHOT 默认接入。补充 RSS/Atom 或 GitHub Releases JSON，最多 12 个。示例：Hugging Face 博客 RSS：https://huggingface.co/blog/feed.xml。</p><div id="source-list">${s.sources.map(sourceForm).join('')}</div><div class="actions">${button('添加一手来源', 'add-source')} ${button('保存信源', 'save-sources')}</div></div><div class="panel"><h3>本机数据</h3><p class="muted url">${esc(state.dataPath)}</p><p class="muted">正文、证据和图片保存在该目录。密钥保存在同目录的 secrets.json，请按个人敏感配置保管。备份时先停止服务，复制整个目录；分享源码时不要包含数据目录。</p></div>`;
}
function costsPage() { const currencies = [...new Set(state.calls.map(c => c.currency))]; return `<div class="hero"><div><div class="eyebrow">Know what you use</div><h1>用量与费用记录。</h1><p>费用仅为按你填写单价计算的估算。失败或未解析的调用也可能已收费。</p></div></div><div class="stats">${currencies.map(currency => `<div class="stat"><strong>${state.calls.filter(c => c.currency === currency && c.amount !== null).reduce((n, c) => n + c.amount, 0).toFixed(4)} ${esc(currency)}</strong><small>最近 200 次调用的已记录估算</small></div>`).join('')}<div class="stat"><strong>${state.calls.filter(c => c.amount === null).length}</strong><small>费用未知的调用</small></div></div><div class="panel">${state.calls.length ? state.calls.map(c => `<div class="costrow"><div><strong>${esc(c.purpose)}</strong> · ${esc(c.model)}<div class="callstatus">${date(c.at)} · ${esc(c.status)} · ${esc(c.usage)}</div></div><span>${c.amount === null ? '费用未知' : c.amount.toFixed(5) + ' ' + esc(c.currency) + '（估算）'}</span></div>`).join('') : '<p class="muted">还没有模型调用。</p>'}</div>`; }
function render() {
  if (!state) return;
  const nav = [['daily', '◉', '今日雷达'], ['x', '𝕏', 'X 信号源'], ['viral', '✦', '爆款创作'], ['growth', '↗', 'X 起号'], ['search', '⌕', '主题与材料'], ['projects', '▤', '我的稿件'], ['settings', '⚙', '模型与风格'], ['costs', '↗', '用量与费用'], ['skills', '◇', '已接入技能']];
  $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><div class="brandmark">r.</div><div><strong>选题雷达</strong><small>PRIVATE X STUDIO</small></div></div><nav class="nav">${nav.map(([key, icon, label]) => `<button data-action="nav" data-view="${key}" class="${view === key || view === 'project' && key === 'projects' ? 'active' : ''}"><span>${icon}</span>${label}</button>`).join('')}</nav><div class="sidebarfooter"><span class="dot"></span> Windows 本机运行<br>你的想法，留在自己的工作台。<br><small>手动发布 · 原创表达</small></div></aside><main class="main"><header class="topbar"><span>私人创作工作台 / ${nav.find(n => n[0] === view)?.[2] || '图文创作'}</span><span class="pill">${state.date} · 本机保存</span></header>${busy ? `<div class="progressbox" role="status"><span class="spinner"></span><span id="progress-message">${esc(busyMessage)}</span></div>` : ''}${view === 'daily' ? dailyPage() : view === 'x' ? xPage(state, xFilters) : view === 'viral' ? viralPage(state, viralForm, { esc, link, date, button, notice }) : view === 'growth' ? growthPage(state, growthForm, { esc, link, date, button, notice }) : view === 'search' ? searchPage() : view === 'project' ? projectPage() : view === 'projects' ? projectsPage() : view === 'skills' ? skillsPage() : view === 'settings' ? settingsPage() : costsPage()}<footer>AIHOT + 观察名单中的 X 公开帖子 + 你配置的一手来源 · AI 结果需要核实 · 手动发布到 X</footer></main></div>${view === 'x' ? xReader(state, xOpened) : ''}`;
  if ($('#x-management')) $('#x-management').open = xManageOpen;
  if ($('#x-reader')) $('#x-reader').showModal();
  if (busy) for (const el of document.querySelectorAll('button,input,textarea,select')) el.disabled = true;
}
function project() { return state.projects.find(p => p.id === projectId); }
function pd(extra = {}) { const p = project(); return { id: p.id, revision: p.revision, ...extra }; }
function value(key) { return $('#' + key)?.value ?? ''; }
function providerInput() { return Object.fromEntries(['textBase', 'textModel', 'textKey', 'imageMode', 'imageBase', 'imageModel', 'imageKey', 'currency', 'inputPrice', 'outputPrice', 'imagePrice'].map(k => [k, value(k)])); }
function planInput() { return project().plan.map((i, n) => ({ ...i, kind: value('plan-kind-' + n), title: value('plan-title-' + n), description: value('plan-description-' + n), prompt: value('plan-prompt-' + n), points: value('plan-points-' + n).split('\n').map(s => s.trim()).filter(Boolean) })); }
function sourceForm(s, n) { return `<div class="source-form planitem" data-source-index="${n}"><div class="fieldgrid">${field('来源名称', 'source-name-' + n, s.name)}<label>来源类型<select id="source-kind-${n}"><option value="rss" ${s.kind === 'rss' ? 'selected' : ''}>官方博客 RSS / Atom</option><option value="json" ${s.kind === 'json' ? 'selected' : ''}>GitHub Releases</option></select></label></div>${field('公开来源地址', 'source-url-' + n, s.url, { placeholder: 'https://…' })}<label class="check"><input type="checkbox" id="source-enabled-${n}" ${s.enabled !== false ? 'checked' : ''}>启用此来源</label>${button('移除这一来源', 'remove-source', `data-index="${n}"`)}</div>`; }
function sourceInput() { return [...document.querySelectorAll('.source-form')].map(row => { const n = row.dataset.sourceIndex; return { name: value('source-name-' + n), kind: value('source-kind-' + n), url: value('source-url-' + n), enabled: $('#source-enabled-' + n).checked }; }); }
function navigate(next) { view = next; if (next !== 'x') xOpened = null; sessionStorage.setItem('radar-view', next); history.replaceState(null, '', '#' + next); browseStarted = new Date().toISOString(); render(); window.scrollTo(0, 0); }
async function imageFileData(file) { if (!file) throw Error('请先选择图片'); if (file.size > 10 * 1024 * 1024) throw Error('图片超过 10MB'); return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(file); }); }
async function upload(file, planId) { return task('/api/upload', pd({ data: await imageFileData(file), label: file.name, planId })); }
async function act(action, target) {
  if (busy) return;
  if (action === 'nav') return navigate(target.dataset.view);
  if (action === 'growth-tab') { growthForm.tab = target.dataset.tab; persistGrowthForm(growthForm); render(); }
  if (action === 'growth-category') { growthForm.category = target.dataset.category; persistGrowthForm(growthForm); render(); }
  if (action === 'growth-use-study') {
    const a = await task('/api/growth/use-study', { studyId: target.dataset.id });
    growthForm.referenceId = a.reference.handle + ':' + a.reference.id;
    growthForm.analysisId = a.id; growthForm.mode = 'cached'; growthForm.tab = 'create';
    persistGrowthForm(growthForm); render(); window.scrollTo(0, 0); toast('已载入这篇案例的拆解，可以填写自己的材料写新帖');
  }
  if (action === 'growth-use-reference') {
    const r = state.growth.references.find(r => r.id === target.dataset.id && r.handle.toLowerCase() === target.dataset.handle.toLowerCase());
    if (!r) throw Error('该帖目前不在缓存中，请到 X 信号源刷新，或手动粘贴原文');
    growthForm.referenceId = r.handle + ':' + r.id; growthForm.mode = 'cached'; growthForm.tab = 'create'; persistGrowthForm(growthForm); render(); window.scrollTo(0,0);
  }
  if (action === 'growth-tool-use' || action === 'growth-task-method') {
    const method = action === 'growth-task-method' ? state.growth.library.methods.find(m => m.id === target.dataset.id) : state.growth.library.methods.find(m => m.sources.includes(target.dataset.id));
    growthForm.tab = 'methods'; growthForm.category = method?.category || '全部'; persistGrowthForm(growthForm); render(); window.scrollTo(0,0);
  }
  if (action === 'growth-learn') { await task('/api/growth/progress', { revision: state.growth.progress.revision, kind: 'method', targetId: target.dataset.id, done: !state.growth.progress.learned.includes(target.dataset.id) }); }
  if (action === 'growth-analyze') {
    const r = state.growth.references.find(r => r.handle + ':' + r.id === growthForm.referenceId);
    const a = await task('/api/growth/analyze', { mode: growthForm.mode, handle: r?.handle, postId: r?.id, referenceText: growthForm.referenceText, referenceURL: growthForm.referenceURL });
    growthForm.analysisId = a.id; persistGrowthForm(growthForm); render(); toast('结构拆解已保存，短原句已核对');
  }
  if (action === 'growth-create') {
    const d = await task('/api/growth/create', { analysisId: growthForm.analysisId, topic: growthForm.topic, ownAngle: growthForm.ownAngle, ownMaterial: growthForm.ownMaterial });
    growthForm.draftId = d.id; persistGrowthForm(growthForm); render(); $('#growth-body')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('原创正文和配图提示词已保存');
  }
  if (action === 'growth-save') { const d = state.growth.drafts.find(d => d.id === growthForm.draftId); await task('/api/growth/save', { id: d.id, revision: d.revision, body: value('growth-body') }); delete growthForm.bodies[d.id]; persistGrowthForm(growthForm); render(); toast('正文修改已保存'); }
  if (action === 'growth-copy') { await navigator.clipboard.writeText(value('growth-body')); toast('正文已复制'); }
  if (action === 'growth-copy-image') { const d = state.growth.drafts.find(d => d.id === growthForm.draftId); await navigator.clipboard.writeText(d.images[Number(target.dataset.index)].prompt); toast('提示词已复制'); }
  if (action === 'growth-promote') {
    let d = state.growth.drafts.find(d => d.id === growthForm.draftId);
    if (!d.projectId && value('growth-body') !== d.body) { d = await task('/api/growth/save', { id: d.id, revision: d.revision, body: value('growth-body') }); delete growthForm.bodies[d.id]; }
    const p = await task('/api/growth/promote', { id: d.id, revision: d.revision }); projectId = p.id; sessionStorage.setItem('radar-project', p.id); persistGrowthForm(growthForm); navigate('project'); toast('已转入我的稿件，请确认提纲、正文和配图方案');
  }
  if (action === 'growth-metrics') {
    const m = { ...growthForm.metric };
    for (const k of ['publishedAt','observedAt']) if (m[k]) m[k] = new Date(m[k]).toISOString();
    await task('/api/growth/metrics', m); growthForm.metric = {}; persistGrowthForm(growthForm); render(); toast('数据快照已保存，未知指标保留为空');
  }
  if (action === 'viral-tab') { viralForm.tab = target.dataset.tab; persistViralForm(viralForm); render(); }
  if (action === 'viral-refresh') { if (!viralForm.handles.length || viralForm.handles.length > 4) throw Error('请选择 1—4 位博主'); for (const handle of viralForm.handles) await task('/api/x/refresh', { handle }); toast('所选博主的公开帖子已刷新，请查看采集状态后研究'); }
  if (action === 'viral-research') { const report = await task('/api/viral/research', { handles: viralForm.handles }); viralForm.studyId = report.id; viralForm.styleHandle = 'all'; persistViralForm(viralForm); render(); toast('研究报告已保存，每条结论都附原帖证据'); }
  if (action === 'viral-use-study') { viralForm.tab = 'write'; persistViralForm(viralForm); render(); window.scrollTo(0, 0); }
  if (action === 'viral-create') { const draft = await task('/api/viral/create', { studyId: viralForm.studyId, styleHandle: viralForm.styleHandle, topic: viralForm.topic, ownAngle: viralForm.ownAngle, ownMaterial: viralForm.ownMaterial, sources: viralForm.sources }); viralForm.draftId = draft.id; persistViralForm(viralForm); render(); $('#viral-body')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('原创参考稿和配图提示词已保存，请核对事实'); }
  if (action === 'viral-save') { const d = state.viral.drafts.find(d => d.id === viralForm.draftId); await task('/api/viral/save', { id: d.id, revision: d.revision, body: value('viral-body') }); delete viralForm.bodies[d.id]; persistViralForm(viralForm); render(); toast('正文修改已保存'); }
  if (action === 'viral-copy') { await navigator.clipboard.writeText(value('viral-body')); toast('当前正文已复制'); }
  if (action === 'viral-copy-image') { const d = state.viral.drafts.find(d => d.id === viralForm.draftId), n = Number(target.dataset.index); await navigator.clipboard.writeText(viralForm.imagePlans?.[d.id]?.[n]?.prompt ?? d.images[n].prompt); toast('配图提示词已复制，可粘贴到 ChatGPT 网页生成'); }
  if (action === 'viral-save-images') {
    let d = state.viral.drafts.find(d => d.id === viralForm.draftId); const images = viralForm.imagePlans?.[d.id] || d.images;
    if (value('viral-body') !== d.body) { d = await task('/api/viral/save', { id: d.id, revision: d.revision, body: value('viral-body') }); delete viralForm.bodies[d.id]; }
    await task('/api/viral/images/save', { id: d.id, revision: d.revision, images }); delete viralForm.imagePlans[d.id]; persistViralForm(viralForm); render(); toast('配图提示词已保存并绑定当前正文');
  }
  if (action === 'viral-images' || action === 'viral-import-image') {
    const d = state.viral.drafts.find(d => d.id === viralForm.draftId);
    if (value('viral-body') !== d.body) throw Error('正文有未保存的修改，请先保存正文，再核对配图提示词');
    if (viralForm.imagePlans?.[d.id] && JSON.stringify(viralForm.imagePlans[d.id]) !== JSON.stringify(d.images)) throw Error('配图提示词有修改，请先点击「保存并确认配图提示词」');
    if (action === 'viral-images') {
      await task('/api/viral/images', { id: d.id, revision: d.revision, ...(target.dataset.index !== undefined ? { indices: [Number(target.dataset.index)] } : {}), force: target.dataset.force === 'true' });
      toast('图片已自动保存，可以在这里预览和下载');
    } else {
      const n = Number(target.dataset.index), data = await imageFileData($('#viral-image-file-' + n)?.files[0]);
      await task('/api/viral/images/upload', { id: d.id, revision: d.revision, index: n, data }); toast('图片已导入并保存');
    }
    $('#viral-image-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (action === 'viral-promote') { let d = state.viral.drafts.find(d => d.id === viralForm.draftId); const body = value('viral-body'); if (!d.projectId && body !== d.body) { d = await task('/api/viral/save', { id: d.id, revision: d.revision, body }); delete viralForm.bodies[d.id]; } const p = await task('/api/viral/promote', { id: d.id, revision: d.revision }); projectId = p.id; sessionStorage.setItem('radar-project', p.id); persistViralForm(viralForm); navigate('project'); toast('已转入我的稿件：先确认提纲，再核对正文和配图'); }
  if (action === 'x-refresh') { await task('/api/x/refresh', { handle: target.dataset.handle || '' }); toast('X 采集结束；覆盖范围和缺口可在账号状态中查看'); }
  if (action === 'x-daily') { await task('/api/recommend', { refresh: true }); navigate('daily'); toast('已用当前信源重新筛选今日选题'); }
  if (action === 'x-manage') { xManageOpen = true; $('#x-management').open = true; $('#x-add-handle').focus(); $('#x-management').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  if (action === 'x-add') {
    const handle = value('x-add-handle').trim(), name = value('x-add-name').trim(); if (!handle) throw Error('请填写 @用户名或账号主页链接');
    await task('/api/x/accounts', { revision: state.x.config.revision, accounts: [...state.x.config.accounts, { handle, name, enabled: true }] });
    toast('账号已添加；点击单独刷新即可取得帖子');
  }
  if (action === 'x-toggle' || action === 'x-remove') {
    const handle = target.dataset.handle;
    const accounts = action === 'x-remove' ? state.x.config.accounts.filter(a => a.handle !== handle) : state.x.config.accounts.map(a => a.handle === handle ? { ...a, enabled: !a.enabled } : a);
    if (action === 'x-remove' && xFilters.account === handle) xFilters.account = 'all';
    await task('/api/x/accounts', { revision: state.x.config.revision, accounts }); toast(action === 'x-remove' ? '已移出观察名单' : '账号状态已保存');
  }
  if (action === 'x-open') { xOpened = { handle: target.dataset.handle, id: target.dataset.id }; render(); }
  if (action === 'x-close') { xOpened = null; render(); }
  if (action === 'x-thread') { await task('/api/x/thread', { handle: target.dataset.handle, postId: target.dataset.id }); toast('已查询作者串文，公开来源仍可能缺帖'); }
  if (action === 'x-topic') { const data = { handle: target.dataset.handle, postId: target.dataset.id }; xOpened = null; searchResult = await task('/api/x/topic', data); navigate('search'); }
  if (action === 'x-type') { xFilters.type = target.dataset.value; xFilters.limit = 24; render(); }
  if (action === 'x-account-filter') { xFilters.account = xFilters.account === target.dataset.handle ? 'all' : target.dataset.handle; xFilters.limit = 24; render(); }
  if (action === 'x-clear') { Object.assign(xFilters, { account: 'all', type: 'all', range: '7', query: '', limit: 24 }); render(); }
  if (action === 'x-more') { xFilters.limit += 24; const scroll = window.scrollY; render(); window.scrollTo(0, scroll); }
  if (action === 'collect') { await task('/api/collect'); toast('资讯已读取，尚未生成 AI 精选'); }
  if (action === 'recommend') { await task('/api/recommend'); toast('今日精选已保存'); }
  if (action === 'recommend-refresh') { await task('/api/recommend', { refresh: true }); toast('已用当前信源重新筛选今日选题'); }
  if (action === 'search') { const query = value('query'); searchResult = await task('/api/search', { query }); render(); }
  if (action === 'material') { const data = { material: value('material-text'), url: value('material-url') }; searchResult = await task('/api/material', data); render(); }
  if (action === 'select') { const p = await task('/api/project', { cardId: target.dataset.id, startedAt: browseStarted }); projectId = p.id; sessionStorage.setItem('radar-project', p.id); navigate('project'); }
  if (action === 'open') { projectId = target.dataset.id; sessionStorage.setItem('radar-project', projectId); navigate('project'); }
  if (action === 'outline') { const d = pd({ angle: value('angle'), outline: value('outline') }); await task('/api/outline', d); toast('提纲已确认'); }
  if (action === 'source') await task('/api/source', pd({ url: target.dataset.url }));
  if (action === 'evidence') await task('/api/evidence', pd({ material: value('evidence-text') }));
  if (action === 'test') await task('/api/test', pd({ notes: value('test-notes') }));
  if (action === 'upload-evidence') await upload($('#evidence-upload').files[0]);
  if (action === 'upload-plan') await upload($('#upload-' + target.dataset.id).files[0], target.dataset.id);
  if (action === 'draft') await task('/api/draft', pd());
  if (action === 'save-draft') { await task('/api/draft/save', pd({ body: value('draft') })); toast('正文版本已保存'); }
  if (action === 'review') { const body = value('draft'); if (body !== project().draft) await task('/api/draft/save', pd({ body })); await task('/api/review', pd()); toast('内容审稿已完成'); }
  if (action === 'approve-draft') { const body = value('draft'); if (body !== project().draft) await task('/api/draft/save', pd({ body })); await task('/api/draft/approve', pd()); }
  if (action === 'plan') await task('/api/plan', pd());
  if (action === 'save-plan') { const images = planInput(); await task('/api/plan/save', pd({ images })); }
  if (action === 'approve-plan') { const images = planInput(); if (JSON.stringify(images) !== JSON.stringify(project().plan)) await task('/api/plan/save', pd({ images })); await task('/api/plan/approve', pd()); }
  if (action === 'image') await task('/api/image', pd({ planId: target.dataset.id }));
  if (action === 'complete') { await task('/api/complete', pd()); toast('图文完成，已记录采用'); }
  if (action === 'back-outline' || action === 'back-draft' || action === 'back-plan') { const p = project(); const stage = action === 'back-outline' ? 'outline' : action === 'back-plan' ? 'plan' : 'draft'; await task('/api/reopen', pd({ stage })); }
  if (action === 'copy') { await navigator.clipboard.writeText(project().draft); toast('正文已复制'); }
  if (action === 'copy-prompt') { const plan = project().plan.find(i => i.id === target.dataset.id && i.kind === 'illustration'); if (!plan) throw Error('配图方案不存在'); await navigator.clipboard.writeText(illustrationPrompt(plan)); toast('配图提示词已复制，请粘贴到 ChatGPT 生成图片'); }
  if (action === 'download-draft') { const blob = new Blob([project().draft], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = project().title.replace(/[<>:"/\\|?*]/g, '').slice(0, 80) + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  if (action === 'settings' || action === 'model-test' || action === 'image-test') { const d = providerInput(); await task('/api/settings', d); if (action === 'model-test') { await task('/api/model/test'); toast('写作连接测试通过'); } else if (action === 'image-test') { await task('/api/image/test'); toast('测试图已生成并保存，可在图片设置中查看'); } else toast('模型设置已保存'); }
  if (action === 'save-samples' || action === 'style') { await task('/api/settings', { samples: value('samples'), tone: value('tone') }); if (action === 'style') await task('/api/style'); else toast('样本已保存'); }
  if (action === 'approve-style') { await task('/api/settings', { style: value('style'), styleApproved: true }); toast('风格说明已确认'); }
  if (action === 'add-source') { const forms = [...document.querySelectorAll('.source-form')]; if (forms.length >= 12) throw Error('最多添加 12 个来源'); const n = Math.max(-1, ...forms.map(f => Number(f.dataset.sourceIndex))) + 1; $('#source-list').insertAdjacentHTML('beforeend', sourceForm({ name: '', url: '', kind: 'rss', enabled: true }, n)); }
  if (action === 'remove-source') document.querySelector(`.source-form[data-source-index="${target.dataset.index}"]`).remove();
  if (action === 'save-sources') { const sources = sourceInput(); await task('/api/settings', { sources }); toast('信源已保存'); }
  if (action === 'clear-text' || action === 'clear-image') { await task('/api/settings', action === 'clear-text' ? { clearTextKey: true } : { clearImageKey: true }); toast('密钥已移除（环境变量提供的密钥需在环境中移除）'); }
}
document.addEventListener('click', e => { const target = e.target.closest('[data-action]'); if (target) act(target.dataset.action, target).catch(err => { toast(err.message); }); });

document.addEventListener('change', event => {
  const el = event.target;
  const growthKey = { 'growth-mode':'mode', 'growth-reference-select':'referenceId', 'growth-analysis-select':'analysisId', 'growth-draft-select':'draftId' }[el.id];
  if (growthKey) { growthForm[growthKey] = el.value; persistGrowthForm(growthForm); render(); }
  if (el.dataset.growthTask) { task('/api/growth/progress', { revision: state.growth.progress.revision, kind: 'task', targetId: el.dataset.growthTask, done: el.checked }).catch(err => toast(err.message)); }
  if (el.dataset.viralHandle) { const h = el.dataset.viralHandle; if (el.checked && viralForm.handles.length >= 4) { el.checked = false; return toast('每次最多研究 4 位博主'); } viralForm.handles = el.checked ? [...viralForm.handles, h] : viralForm.handles.filter(s => s !== h); persistViralForm(viralForm); render(); }
  if (el.dataset.viralSource) { if (el.checked && viralForm.sources.length >= 4) { el.checked = false; return toast('每篇最多选 4 条事实材料'); } viralForm.sources = el.checked ? [...viralForm.sources, { handle: el.dataset.handle, postId: el.dataset.viralSource }] : viralForm.sources.filter(s => s.postId !== el.dataset.viralSource); persistViralForm(viralForm); render(); }
  const key = { 'viral-study-select': 'studyId', 'viral-write-study': 'studyId', 'viral-draft-select': 'draftId', 'viral-source-account': 'sourceAccount', 'viral-style-handle': 'styleHandle' }[el.id];
  if (key) { viralForm[key] = el.value; if (key === 'studyId') viralForm.styleHandle = 'all'; persistViralForm(viralForm); render(); }
});
document.addEventListener('input', event => {
  const el = event.target, key = { 'viral-topic': 'topic', 'viral-angle': 'ownAngle', 'viral-material': 'ownMaterial' }[el.id];
  const growthKey = { 'growth-reference-text':'referenceText', 'growth-reference-url':'referenceURL', 'growth-topic':'topic', 'growth-angle':'ownAngle', 'growth-material':'ownMaterial' }[el.id];
  if (growthKey) { growthForm[growthKey] = el.value; persistGrowthForm(growthForm); }
  if (el.id.startsWith('growth-metric-')) { growthForm.metric[el.id.slice(14)] = el.value; persistGrowthForm(growthForm); }
  if (el.id === 'growth-body') { growthForm.bodies[growthForm.draftId] = el.value; persistGrowthForm(growthForm); $('#growth-char-count').textContent = [...el.value].length + ' 字符 · 有修改，请先保存'; }
  if (key) { viralForm[key] = el.value; persistViralForm(viralForm); }
  if (el.id === 'viral-body') { viralForm.bodies[viralForm.draftId] = el.value; persistViralForm(viralForm); $('#viral-char-count').textContent = [...el.value].length + ' 字符 · 有修改，请先保存'; }
  if (el.dataset.viralImageKey) {
    const d = state.viral.drafts.find(d => d.id === viralForm.draftId); viralForm.imagePlans ||= {};
    viralForm.imagePlans[d.id] ||= d.images.map(i => ({ ...i }));
    viralForm.imagePlans[d.id][Number(el.dataset.viralImageIndex)][el.dataset.viralImageKey] = el.value; persistViralForm(viralForm);
  }
  if (el.id === 'viral-source-query') { viralForm.sourceQuery = el.value; persistViralForm(viralForm); clearTimeout(viralQueryTimer); viralQueryTimer = setTimeout(() => { render(); const input = $('#viral-source-query'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }, 300); }
});
document.addEventListener('change', e => { if (e.target.id === 'angle-select') $('#angle').value = e.target.value; if (e.target.id === 'imageMode') $('#image-api-settings').open = e.target.value === 'api'; });
document.addEventListener('change', e => { const key = { 'x-filter-account': 'account', 'x-filter-range': 'range', 'x-filter-sort': 'sort' }[e.target.id]; if (key) { xFilters[key] = e.target.value; xFilters.limit = 24; render(); } });
document.addEventListener('input', e => { if (e.target.id !== 'x-filter-query') return; clearTimeout(xQueryTimer); const text = e.target.value; xQueryTimer = setTimeout(() => { xFilters.query = text; xFilters.limit = 24; render(); const input = $('#x-filter-query'); if (input) { input.focus(); input.setSelectionRange(text.length, text.length); } }, 250); });
document.addEventListener('toggle', e => { if (e.target.id === 'x-management' && e.target.isConnected) xManageOpen = e.target.open; }, true);
document.addEventListener('close', e => { if (e.target.id === 'x-reader' && e.target.isConnected) xOpened = null; }, true);
document.addEventListener('error', e => { if (e.target.matches?.('.x-cover img,.x-avatar img')) e.target.remove(); }, true);
document.addEventListener('input', e => { if (e.target.id === 'draft') $('#char-count').textContent = [...e.target.value].length; });
async function boot() {
  await reload(); render();
  const running = state.jobs.find(j => j.status === 'running');
  if (running) { busy = true; busyMessage = running.message || '本机任务正在执行，等待取得结果。'; render(); let j = running; while (j.status === 'running') { if (j.message && $('#progress-message')) $('#progress-message').textContent = j.message; await new Promise(r => setTimeout(r, 1200)); j = await api('/api/job/' + j.id); } busy = false; await reload(); render(); if (j.status === 'error') toast(j.error); }
  if (view === 'x' && !running) {
    const needsRefresh = state.x.config.accounts.some(a => a.enabled && !state.x.accounts.some(s => s.handle.toLowerCase() === a.handle.toLowerCase() && new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(s.report.lastAttemptAt)) === state.date));
    if (needsRefresh) { try { await task('/api/x/refresh'); } catch (e) { toast(e.message); } }
  }
  if (!state.daily && !running) {
    const s = state.settings;
    try { if (view === 'daily' && s.hasTextKey && s.textBase && s.textModel) await task('/api/recommend'); else if (view === 'daily' && (!state.pool || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(state.pool.fetchedAt)) !== state.date)) await task('/api/collect'); }
    catch (e) { toast(e.message); }
  }
}
boot().catch(e => { $('#app').textContent = '工作台未能打开：' + e.message; });
