import fs from 'node:fs/promises';
import { normalizeXPost } from '../x-radar/x-source.mjs';

const dir = new URL('./low-follower-20261006/', import.meta.url);
const verified = JSON.parse(await fs.readFile(new URL('verified.json', dir), 'utf8'));
const primary = JSON.parse(await fs.readFile(new URL('original-page-check.json', dir), 'utf8'));
const notes = {
  lieflat_3: {
    title: '把图表工具写成读者看得见的成果', format: '视频演示 + 中长文字',
    takeaway: '先说读者能得到什么，再说明图型、使用方式和输出场景；把功能清单放到成果后面。',
    readerTask: '希望给报告或 PPT 做图，但不想先学完整的数据可视化工具链的人。',
    evidence: ['一个 skill，让你做出', '把你的数据或者'], theory: '使用与满足', confidence: '中',
    mechanism: '文字把工具与报告、PPT 等具体任务连接，读者有日后使用和收藏的理由。实际收藏数较高，但不能据此证明每个收藏者的动机。',
    structure: [
      ['成果开头', '先提出一个可见的输出，而不是先介绍技术名词。', '用{工具}，把{你的材料}做成{可见成果}。'],
      ['能力与场景', '选两三项与读者任务有关的能力，分别说明能用在哪里。', '{能力一}用于{场景一}；{能力二}用于{场景二}。'],
      ['上手入口', '讲清输入什么、怎样调用、拿到什么格式。', '准备{输入} → 执行{操作} → 检查{输出}。'],
      ['使用限制', '补充依赖、真实数据检查和当前输出限制。', '先核对{条件}；{限制}仍需要人工处理。']
    ],
    visual: '已查看视频缩略图：米白背景、棕色分区、图表说明文字可见，首帧的主要绘图区为空。没有播放全段，不能断言成品图质量或动效效果。你的图文应把已完成的图表放在封面，而不是只展示空画布。',
    scope: '作者主帖文字 + 视频缩略图；未播放全段；未运行仓库。',
    risks: ['没有取得同一时期可用的普通主帖对照，不能判断这是否是该账号的异常峰值。', '作者开源项目与其他渠道可能带来流量，粉丝数不能代表全部触达基础。', '图表数量、支持格式和项目热度是原帖说法，复用前应核对当前仓库。'],
    idea: '普通人做 AI 工具对比，如何把自己的真实结果做成一张可读图表。',
    discussion: '读者需要的是图表审美，还是更快看懂自己的数据？用两种封面作下一轮观察。'
  },
  longhaiqwe123: {
    title: 'AI 做得出来，但界面不好看：把新问题讲清楚', format: 'X 长文 + 封面',
    takeaway: '找到上一项能力解决后出现的新瓶颈，再用可核对的图文案例解释它。',
    readerTask: '已经用 AI 做出网页或小工具，但界面层级、间距和可读性不理想的人。',
    evidence: ['默认 UI 丑陋', '先灰度后点睛'], theory: '框架', confidence: '中',
    mechanism: '文章把困难从“我没有艺术天分”重新解释为可以练习的设计决策。读者获得具体改进方向，收藏可能用于日后的设计检查；这属于机制推断。',
    structure: [
      ['新瓶颈', '承认 AI 已解决的一部分，再指出读者仍然遇到的具体问题。', '{工具}解决了{旧问题}，但{新瓶颈}仍然影响{任务}。'],
      ['重新定义问题', '把抽象能力拆成可以观察的决策。', '{问题}可以先拆成{维度一}、{维度二}、{维度三}。'],
      ['规则与对照', '一个规则配一个自己的前后对照，并解释改动。', '{原来的表现} → 调整{一个变量} → 检查{新结果}。'],
      ['留下检查表', '将正文浓缩成可实际使用的检查项，注明来源。', '下次做{任务}，先检查{三项}，再根据{真实场景}调整。']
    ],
    visual: '已查看文章封面：大标题突出 UI 设计主题，副标题明确承诺前后对比，暗色渐变与浅色文字形成层级。已读长文正文，未逐张检查正文图片；不能把作者提到的所有对比图都称为已验证。',
    scope: '作者主帖 + 已取得长文正文 + 文章封面；未逐张检查正文图片。',
    risks: ['同期取得的同格式长文对照只有 1 篇，不能用大量短帖的中位数夸大长文优势。', '文章依托他人设计著作。借鉴问题和组织方式，不复制其整套文字或插图。', '文中的用户耐心、信任和效果描述未在本次研究中独立验证。'],
    idea: 'AI 生成的图片为什么“能看但不好读”：用自己的三张图检查字号、层级与留白。',
    discussion: '普通读者最先看不懂的是标题、步骤，还是图片里的小字？'
  },
  criscxuan: {
    title: '从使用成本出发，比较四种解决路径', format: '中文长帖 + 项目链接',
    takeaway: '把读者纠结的选择变成决策表，逐项交代能力、代价和适用条件。',
    readerTask: '在意 AI 编程额度与本地操作能力，想比较不同连接方案的使用者。',
    evidence: ['先对齐一下项目', '所以我会这样选'], theory: '使用与满足', confidence: '中',
    mechanism: '作者围绕实际选择组织材料，每个方案都写能力与代价，最后给条件式选择。读者可能把长帖作为决策资料，而不只是读一次新闻。未采集评论，实际动机仍待验证。',
    structure: [
      ['具体矛盾', '从读者正在承担的成本或重复操作开始，不承诺无代价替代。', '我想完成{任务}，但现在卡在{成本或限制}。'],
      ['对齐选项', '先列选项与核心差异，让读者知道比较范围。', '这次比较{选项一}、{选项二}、{选项三}，共同目标是{任务}。'],
      ['一致维度', '用输入、能力、依赖、限制等一致维度解释各方案。', '{方案}能做{能力}；需要{条件}；代价是{限制}。'],
      ['条件式选择', '按用户情况选择，保留不能确定的事项。', '如果你{场景一}，先考虑{方案一}；如果{场景二}，核对{方案二}。']
    ],
    visual: '主帖没有取得独立图片，不是靠封面大字的样本。可借鉴文字的比较结构，为自己的新帖制作原创决策表；这属于新帖建议，不能称为原帖配图分析。',
    scope: '作者主帖完整文字；引用的前帖不计入本帖文本证据；未运行列出的项目。',
    risks: ['长帖承接了前一天的高表现帖，可能已有连续传播，不能把全部效果归因于本帖结构。', '参考里的项目能力、额度和安全边界是作者整理，本次没有逐个安装核对。', '同期样本仍有不同题材与帖龄，数据对照只描述观察，不证明因果。'],
    idea: '普通人做 AI 图文：网页、API、手动截图三条路径，按费用、操作量和可控性选择。',
    discussion: '读者最在意少花钱、少操作，还是自己掌握生成结果？'
  },
  justhalfbit: {
    title: '发现一个具体限制，再给读者能操作的办法', format: '中长帖 + 软件截图',
    takeaway: '把经验写成准备条件、操作步骤和检查结果；让读者知道下一步实际做什么。',
    readerTask: '已有 AI 工具和角色配置，希望理解如何整理或迁移自己获准使用的配置的人。',
    evidence: ['问题是只能在', '只读 WorkBuddy'], theory: '使用与满足', confidence: '中',
    mechanism: '开头建立“有用但受限制”的具体问题，正文给详细操作指令，因此有保存再执行的用途。收藏数据支持它被保存过，但不能证明迁移成功或人人都适用。',
    structure: [
      ['现有资源与限制', '说清手里有什么，以及什么环节不方便。', '你已经有{资源}，但{限制}让它难以用于{任务}。'],
      ['准备条件', '列出版本、已获准使用的材料和操作前提。', '先准备{条件}，确认{权限或兼容性}。'],
      ['具体指令', '把查找、选择、执行、检查分别写成动作。', '定位{输入} → 选择{对象} → 执行{操作} → 检查{结果}。'],
      ['下一次怎么用', '解释复用入口，同时记录失败情况。', '以后遇到{同类任务}，复用{步骤}；失败时先检查{限制}。']
    ],
    visual: '已查看唯一配图：WorkBuddy 的专家列表界面，读者能看到资源在哪里。截图不能单独证明配置已成功迁移。你的图文更适合补上开始前、执行步骤、执行后三类自己实际操作的截图。',
    scope: '作者主帖完整文字 + 配图；未执行迁移指令。',
    risks: ['这里学习教程的组织方式，不自动执行原帖指令，也不代替许可与兼容性核对。', '正文暗含文件布局和工具版本，版本改变可能让方法失效。', '同作者同期对照仍不是随机实验，不能直接推出提示词长度与流量的因果。'],
    idea: '把自己常用的 AI 提示词整理成可调用模板：准备、存放、调用、检查。',
    discussion: '读者拿到教程后，最容易卡在准备、执行，还是确认成功？'
  },
  nian_tu41685: {
    title: '用反常识案例，把读者带到一个新判断', format: '引用转发 + 中文评论',
    takeaway: '引用别人的案例后，提出自己能解释的判断；保留案例归属和不确定性。',
    readerTask: '想理解 AI 能力边界、人如何参与判断的普通技术读者。',
    evidence: ['质疑前提、测量瓶颈', '需要由屏幕前的你'], theory: '框架', confidence: '中',
    mechanism: '内容从性能故事转向人的判断作用，给“AI 说不行时怎么办”一个新的问题框架。反差可能吸引阅读，结尾可能帮助读者表达立场；分享原因和传播链均未知。',
    structure: [
      ['案例反差', '先指出材料中可核对的意外结果，避免混用指标。', '原本以为{限制}无法解决，但{案例}展示了{新观察}。'],
      ['解释过程', '简要说清改变了哪个前提，事实属于谁。', '{原作者}尝试改变{前提}，随后观察到{结果}。'],
      ['提出自己的判断', '说明这个案例让你重新考虑什么，不上升为绝对规律。', '这让我更在意{判断问题}，而不只是{表面结果}。'],
      ['读者下一步', '给一个可执行的检查问题，保留条件。', '下次遇到{场景}，先核对{证据}，再问{一个问题}。']
    ],
    visual: '没有取得本帖独立配图。分析只使用作者自己的评论，不把被引用作者的案例当成这位作者的亲测。',
    scope: '引用转发的作者评论；被引用案例未独立复现。',
    risks: ['80 粉由采集时未登录 X 主页确认；发帖时粉丝数未知，不能称“80 粉发帖时就爆了”。', '同一时期只找到 1 条不够同类的普通帖，合适的对照样本为 0，不能计算可信的账号日常基线。', '开头把单项速度与并行总吞吐相比较，口径可能不同；不能直接复用“快几十倍”的结论。', '关于 AI 思维与工程优化的说法是作者解释，不能当作完整技术结论。'],
    idea: 'AI 说这个任务做不了时，普通人先检查输入、限制和验证方式。',
    discussion: '哪些情况需要换工具，哪些情况只是原来的问题问错了？'
  },
  AI_DVD6: {
    title: '先回应新手的顾虑，再展示一次具体案例', format: '中长帖 + 演示视频',
    takeaway: '明确写给谁，交代一次具体任务和成果，把教程与成品入口指给读者。',
    readerTask: '没写过剧本、没画过分镜，想尝试 AI 创作的新手。',
    evidence: ['我不会写剧本', '完整教程、Prompt'], theory: '使用与满足', confidence: '中',
    mechanism: '文字先点出新手的技能顾虑，再描述一次具体任务和成品入口，读者可以将它用于尝试创作。降低顾虑的作用属于推断，实际完成率没有取得。',
    structure: [
      ['明确对象', '写出读者的真实顾虑，不夸张地宣布所有门槛消失。', '如果你还不会{技能}，可以先尝试{较小任务}。'],
      ['限定任务', '把输入、时长或成果范围讲清楚。', '这次目标是{一个有限成果}，输入包括{材料}。'],
      ['过程和结果', '展示做了哪些操作，以及实际输出。', '执行{步骤}后得到{结果}，其中{环节}仍需人工调整。'],
      ['完整入口', '把模板、截图和成品放在能核对的位置。', '{教程入口}说明操作，{成品入口}展示结果，先看{条件}再尝试。']
    ],
    visual: '已查看视频缩略图：剪辑软件界面、时间线与人物画面作为背景，大字说明从零制作短剧的结果。没有播放教程与评论区成片；缩略图不能证明全自动完成或新人成功率。',
    scope: '作者主帖完整文字 + 视频缩略图；未取得回复里的完整教程或成片。',
    risks: ['“不需要会”与收入、量产相关表达承诺较大；自己的帖子应补充成本、学习与人工调整。', '作者的亲测属于作者，不能改写成你的亲测。', '视频帖与普通长文、引用帖的表现不应直接当作同格式实验。'],
    idea: '不会设计也能先做一张 AI 知识卡片：展示自己的输入、两次调整和最终图片。',
    discussion: '让新手完成第一张图，最少需要交代哪些准备条件？'
  },
  Minsi_AI: {
    title: '把行业进展翻译成普通人能理解的成果', format: '中文解读 + 引用视频',
    takeaway: '先讲新的可见成果，再用少量能力和应用解释它意味着什么，明确素材来源。',
    readerTask: '对 AI 新用途好奇，但未必了解 CAD 或制造流程的读者。',
    evidence: ['从“写代码”', '开始进入真实制造'], theory: '框架', confidence: '中',
    mechanism: '文字将 Coding Agent 从软件输出重新解释成可能连接实物制作的工具，突出能力边界的变化。新用途可能带来兴趣，但曝光来源、推荐链和受众反应未取得。',
    structure: [
      ['可见成果', '用普通词语说新能力能产生什么。', '{AI 工具}现在尝试把{输入}变成{具体成果}。'],
      ['少量能力', '选三项与成果相关的能力，不堆技术名词。', '它支持{能力一}、{能力二}，在{场景}中可以理解为{作用}。'],
      ['变化意义', '把新能力和旧方式比较，保持确定程度。', '以前主要完成{旧任务}，这次展示了{新方向}。'],
      ['来源和条件', '保留原始演示，区分展示与成熟可用。', '原始演示来自{来源}；要实际用于{任务}，还需核对{条件}。']
    ],
    visual: '已查看引用视频的缩略图：text-to-cad 的输入界面处于等待状态，没有显示完成的 CAD 模型。未播放全段，不能称为已核对生成结果。',
    scope: '作者解读文字 + 视频缩略图；视频来自被链接的原作者，未复现项目。',
    risks: ['375 粉是当前主页数字，发帖时粉丝数未知。', '视频来自另一位作者，不是这位博主已被验证的亲测成果。', '制造适配、文件格式与本机运行等功能是原帖说法，本次没有确认生产可用性。'],
    idea: '把一项 AI 新功能翻译成“普通人可以拿它完成什么”，同时写明目前还缺什么。',
    discussion: '读者需要看的是技术能力列表，还是一个完整使用场景？'
  }
};

const typeOf = p => p.article ? 'article' : p.media?.videos?.length ? 'video' : p.media?.photos?.length ? 'photo' : 'text';
const median = a => a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : null;
const studies = verified.studies.map(s => {
  const p = s.post, n = notes[p.author.screen_name], page = primary.pages.find(a => a.handle === p.author.screen_name);
  const normalized = normalizeXPost(p, p.author.screen_name, s.checkedAt);
  if (!normalized || !n) throw Error('Invalid study source');
  const referenceText = [normalized.body, normalized.article?.body].filter(Boolean).join('\n\n');
  for (const quote of n.evidence) if (!referenceText.includes(quote)) throw Error(`Missing quote for ${p.id}: ${quote}`);
  const sameFormat = s.neighboringPosts.filter(t => typeOf(t) === typeOf(p) && t.text?.length >= (p.article ? 0 : p.text.length >= 1000 ? 500 : 150) && Math.abs(t.created_timestamp - p.created_timestamp) <= 7 * 86400 && Date.parse(s.checkedAt) - t.created_timestamp * 1000 >= 86400000 && Number.isFinite(t.views));
  sameFormat.sort((a, b) => a.views - b.views);
  const profileNumber = Number(page?.visibleFollowers?.match(/>\s*([\d,]+)\s+Followers/)?.[1]?.replaceAll(',', ''));
  if (!Number.isFinite(profileNumber) || profileNumber !== p.author.followers) throw Error(`Primary follower mismatch ${p.id}`);
  const mid = Math.floor(sameFormat.length / 2);
  const comparisonPosts = sameFormat.slice(Math.max(0, mid - 1), mid + 2).map(t => ({ id: t.id, url: `https://x.com/${p.author.screen_name}/status/${t.id}`, title: t.article?.title || t.text.split('\n')[0].slice(0, 100), publishedAt: new Date(t.created_timestamp * 1000).toISOString(), views: t.views, likes: t.likes, bookmarks: t.bookmarks }));
  return { id: `low-${p.id}`, postId: p.id, handle: p.author.screen_name, author: p.author.name, url: normalized.url, title: n.title, originalTitle: normalized.title, format: n.format,
    publishedAt: normalized.publishedAt, checkedAt: s.checkedAt, followers: profileNumber, followersAtPublication: null, followersCheckedAt: page.at,
    followersSource: `https://x.com/${p.author.screen_name}`, metricsSource: `https://api.fxtwitter.com/status/${p.id}`, metrics: normalized.metrics,
    referenceText, contentStatus: normalized.article?.contentStatus || 'post_text', referenceKind: 'curated-low-follower',
    takeaway: n.takeaway, readerTask: n.readerTask, hookSummary: n.mechanism, evidence: n.evidence.map(quote => ({ quote })),
    structure: n.structure.map(([role, instruction, template], i) => ({ id: `structure-${i + 1}`, role, instruction, template })),
    layout: ['criscxuan', 'longhaiqwe123'].includes(p.author.screen_name) ? 'comparison' : ['justhalfbit', 'AI_DVD6'].includes(p.author.screen_name) ? 'flow' : 'framework',
    mechanism: { theory: n.theory, confidence: n.confidence, explanation: n.mechanism }, visualAdvice: n.visual, analysisScope: n.scope, caveats: n.risks, ownTopic: n.idea, discussion: n.discussion,
    analyzedBy: 'Codex · dbs-spread 传播机制方法；未经因果验证', analysisAt: new Date().toISOString(),
    comparison: { query: s.baseline.query, fetchedAt: verified.checkedAt, totalRetrieved: s.neighboringPosts.length, sameFormatCount: sameFormat.length, medianViews: sameFormat.length >= 3 ? median(sameFormat.map(t => t.views)) : null, posts: comparisonPosts,
      boundary: '对照取同作者、同格式、前后 7 天、发布至少 24 小时的可取得主帖；长帖至少 500 字，其余文字至少 150 字。少于 3 条不计算中位数。搜索最多翻 2 页，不是完整历史；题材和帖龄仍有差异，累计数据不能证明因果。' }
  };
});
const data = { checkedAt: new Date().toISOString(), criteria: '本轮先筛采集时粉丝≤10000、公开主帖阅读≥10000且点赞或收藏≥200的 AI 相关内容；精选 7 篇均≤5000粉。粉丝、阅读不是发帖时数据；不把阅读/粉丝解释为非粉丝触达率。', discovery: { uniquePosts: 161, candidates: 48, selected: studies.length, range: '2026-08-01 至采集时；精选帖子发布于 2026-09-01 至 2026-10-03', completeCoverage: false }, studies };
await fs.writeFile(new URL('../x-radar/data/low-follower-studies.json', import.meta.url), JSON.stringify(data, null, 2) + '\n', 'utf8');
let report = '# 低粉高表现 X 帖子：第一批拆解\n\n';
report += `采集日期：2026-10-06。${data.criteria}\n\n公开关键词搜索取得 161 条去重记录，其中 48 条满足粉丝范围；再按账号定位、可读原文、可操作价值挑出 7 篇。不是完整 X 覆盖，没有统计检验。粉丝数由未登录 X 主页核对，阅读和互动来自 FxEmbed 公共服务的当次记录；这不是 X 官方开发者 API，未使用用户登录或会话。\n\n拆解使用 [dbs-spread](../.agents/skills/dbs-spread/SKILL.md) 的方法，由 Codex 整理。下面的传播机制是有文本依据的解释，尚未用评论或实验验证。没有改动 cheat-on-content 的 rubric、权重或用户预测状态。\n\n`;
report += '| 原帖 | 当前粉丝 | 累计阅读 | 收藏 | 同格式普通帖样本 |\n|---|---:|---:|---:|---:|\n';
for (const s of studies) report += `| [${s.author}](${s.url}) | ${s.followers} | ${s.metrics.views} | ${s.metrics.bookmarks} | ${s.comparison.sameFormatCount} |\n`;
for (const s of studies) {
  report += `\n## ${s.author}：${s.title}\n\n[原帖](${s.url}) · 发布时间 ${s.publishedAt} · 指标采集 ${s.checkedAt} · [粉丝数主页](${s.followersSource})（核对 ${s.followersCheckedAt}）。\n\n【分析对象】\n\n核心主张：${s.takeaway}\n\n目标受众：${s.readerTask}\n\n主要动作：理解与后续使用；收藏、评论、分享的具体动机未取得。\n\n短原句依据：${s.evidence.map(e => `「${e.quote}」`).join('、')}。\n\n【主导机制】\n\n主理论：${s.mechanism.theory}。${s.mechanism.explanation}\n\n解释边界：不能据此确认流量来源、受众心理或保证新帖效果。置信度：${s.mechanism.confidence}。\n\n【辅助机制】\n\n无。\n\n【结构与图文】\n\n`;
  for (const step of s.structure) report += `- ${step.role}：${step.instruction} 模板：${step.template}\n`;
  report += `\n${s.visualAdvice}\n\n分析范围：${s.analysisScope}\n\n【普通帖对照】\n\n同格式可用样本 ${s.comparison.sameFormatCount} 条；${s.comparison.medianViews === null ? '不足 3 条，不计算基线。' : `当次累计阅读中位数 ${s.comparison.medianViews}。`} ${s.comparison.boundary}\n\n`;
  for (const c of s.comparison.posts) report += `- [${c.title.replace(/[\[\]\n]/g, '')}](${c.url})：${c.views} 阅读，发布于 ${c.publishedAt}。\n`;
  report += `\n【综合推导】\n\n受众情绪假设：无法从文本和累计指标确认实际情绪。\n\n有效立场：${s.takeaway}\n\n预期使用行为：${s.mechanism.explanation}\n\n受众还想听什么：可以先做「${s.ownTopic}」，再收集遇到的具体问题；这是新的选题建议。\n\n【聊天室方向】\n\n核心讨论焦点：${s.discussion}\n\n需要维持的机制：${s.mechanism.theory}对应的读者任务与问题解释。\n\n需要避开的推断：\n\n${s.caveats.map(c => '- ' + c).join('\n')}\n`;
}
report += '\n## 可直接用于你账号的三条研究方向\n\n1. AI 任务的选择题：统一维度比较方案，写清能力、代价与适用条件。\n2. 真实过程教程：从一个小任务开始，用自己的截图和结果配清单。\n3. 案例的增量解读：保留原作者，解释案例让你改变了哪个判断，同时指出数据口径。\n\n目前更有对照价值的是 cxuan、半格、大卫和 Minsi 的样本；龙海、Lieflat、动帧格的同格式对照不足，需要补样本再判断。不能把仅仅低粉而高阅读当作稳定起号公式。\n';
await fs.writeFile(new URL('./低粉高表现帖子拆解-20261006.md', import.meta.url), report, 'utf8');
console.log(JSON.stringify(studies.map(s => ({ author: s.author, followers: s.followers, views: s.metrics.views, baselineN: s.comparison.sameFormatCount, baselineMedian: s.comparison.medianViews, chars: s.referenceText.length })), null, 2));
