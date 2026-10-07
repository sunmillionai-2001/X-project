// Only loaded by isolated acceptance tests. Never imported by the application.
import { mockXFetch } from './mock-x.mjs';
const realFetch = globalThis.fetch;
const item = { id: 'fixture-1', title: '测试专用工具更新', summary: '用于验证流程的合成材料，不是真实资讯。', source: { name: '合成测试来源' }, links: { original: 'https://example.com/article', aihot: 'https://aihot.news/items/fixture-1' }, publishedAt: new Date().toISOString() };
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60', ETag: 'test-etag' } });
let partialImageCalls = 0;
globalThis.fetch = async (url, options = {}) => {
  const u = new URL(url);
  const x = await mockXFetch(u, options); if (x) return x;
  if (u.hostname === 'aihot.news') return json({ items: [item] });
  if (u.hostname === 'example.com') {
    if (u.pathname === '/feed.xml') return new Response(`<rss><channel><item><title>合成 RSS 材料</title><link>https://example.com/rss-article</link><description><![CDATA[<p>验证公开信源读取</p>]]></description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);
    if (u.pathname === '/v1/chat/completions') {
      const input = JSON.parse(options.body); const system = input.messages[0].content; let data;
      if (system.includes('返回 {ok:true}')) data = { ok: true };
      else if (system.includes('执行 X 起号结构拆解')) {
        const user = JSON.parse(input.messages[1].content);
        data = { title: '合成结构拆解', readerTask: '学习具体判断步骤', hookSummary: '从明确问题切入', structure: ['开头问题','方法步骤','边界收尾'].map(role => ({ role, instruction: '用自己的材料解释问题与方法', template: '{读者} 在 {场景} 中根据 {材料} 做判断' })), evidence: [{ quote: user.reference.text.slice(0,8) }], layout: 'flow', visualAdvice: '封面提出问题，流程图解释步骤', caveats: ['仅依据合成单篇文字，不推断流量'] };
      }
      else if (system.includes('分析给定代表帖')) data = { style: '测试风格：具体、清楚，不编造亲测。' };
      else if (system.includes('执行爆款创作研究')) {
        const user = JSON.parse(input.messages[1].content);
        data = { profiles: user.authors.map(a => ({ handle: a.handle, insights: ['style', 'structure', 'method', 'operation'].map((dimension, n) => { const s = user.samples.filter(s => s.handle === a.handle)[n % a.samples.length]; return { dimension, title: '合成研究结论 ' + dimension, observation: '依据合成文字描述可见结构。', interpretation: '仅是文本假设，不能推出真实流量效果。', adaptation: '围绕自己的材料讲清具体问题与限制。', confidence: 'medium', evidence: [{ postId: s.id, quote: s.text.slice(0, 16) }] }; }) })), comparisons: [] };
      }
      else if (system.includes('执行爆款创作写作')) {
        const user = JSON.parse(input.messages[1].content);
        data = { titles: ['合成原创稿标题一', '合成原创稿标题二'], body: '这是一段仅用于隔离流程验收的中文测试稿，不能当作真实资讯或用户文章。'.repeat(28), outline: '讲问题\n讲方法\n讲限制', methodsUsed: [{ insightId: user.study.profiles[0].insights[0].id, application: '合成结构借鉴说明' }], sourceNotes: [{ materialId: user.materials[0].id, quote: user.materials[0].text.slice(0, 16), use: '仅使用合成材料事实' }], verificationNotes: ['测试内容，不用于真实发布'], images: [{ title: '测试原创示意图一', prompt: '合成原创示意图提示词，不伪造截图' }, { title: '测试原创示意图二', prompt: '合成手机可读流程示意图提示词' }] };
        if (input.model === 'growth-missing-citation' && !system.includes('本次请修复')) data.sourceNotes = [];
      }
      else if (system.includes('返回 {body:')) data = { body: '这是一段仅用于隔离流程验收的中文测试稿，不能当作真实资讯或用户文章。'.repeat(28), warnings: ['测试内容，非实测产出'] };
      else if (system.includes('为当前正文提出')) data = { images: [{ kind: 'infographic', title: '流程测试图', description: '验证图文流程', prompt: '', points: ['测试资料仅用于隔离验收', '先确认正文，再制作图片'] }, { kind: 'screenshot', title: '真实截图测试', description: '测试上传', prompt: '', points: [] }] };
      else if (system.includes('最多八项') || system.includes('只提出问题')) { const user = JSON.parse(input.messages[1].content); data = { summary: '测试审稿摘要', audience: '需要了解 AI 工具的普通读者', readerBenefit: '获得一个可执行判断', issues: [{ quote: user.body.slice(0, 20), problem: '测试问题', suggestion: '测试建议' }] }; }
      else { const user = JSON.parse(input.messages[1].content); data = { cards: [{ candidateIds: [user.candidates[0].id], eventKey: 'fixture-event', title: '隔离测试选题', type: 'practice', summary: '仅用于功能测试', reason: '测试阶段确认', angles: ['从用途讲起', '从限制讲起'], outline: '开头说明任务，正文讲方法，结尾说明限制。', needsTest: true, testSteps: ['上传真实截图', '填写观察结果和限制'], facts: ['合成数据，不是真实消息'], unknowns: ['需要测试'], newProgress: '', assessment: { audience: '想尝试 AI 工具的普通读者', readerBenefit: '知道下一步怎么验证', angleBasis: '依据合成材料中的工具更新', materialGap: '仍需读取原文核实', confidence: 'medium' } }] }; }
      return json({ choices: [{ message: { content: JSON.stringify(data) } }], usage: { prompt_tokens: 100, completion_tokens: 100 } });
    }
    if (u.pathname === '/v1/images/generations') {
      const model = JSON.parse(options.body).model;
      if (model === 'partial-image' && ++partialImageCalls === 2) return new Response(JSON.stringify({error:{message:'Image generation is not enabled for this group.'}}),{status:403,headers:{'Content-Type':'application/json'}});
      if (model === 'slow-image') await new Promise(r=>setTimeout(r,200));
      if (model === 'blocked-image') return new Response(JSON.stringify({ error: { message: 'Image generation is not enabled for this group. ' + options.headers.Authorization } }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      if (model === 'invalid-error-image') return new Response('private provider error: ' + options.headers.Authorization, { status: 400 });
      return json({ data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNAAAAABJRU5ErkJggg==' }] });
    }
    return new Response('<html><p>这是一份仅用于验证原文读取功能的合成测试材料。</p>'.repeat(12));
  }
  return realFetch(url, options);
};
