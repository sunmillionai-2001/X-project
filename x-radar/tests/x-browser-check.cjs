const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const bundled = createRequire(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json'));
const { chromium } = bundled('playwright');
const live = process.argv.includes('--live');
const qa = path.resolve(__dirname, '../../research/qa-x-source'); fs.mkdirSync(qa, { recursive: true });
const base = live ? 'http://127.0.0.1:8770' : 'http://127.0.0.1:18773';
let child, browser;
const pause = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  if (!live) {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'x-source-browser-'));
    child = spawn(process.execPath, ['--import', pathToFileURL(path.join(__dirname, 'mock-network.mjs')).href, path.join(__dirname, '../server.mjs')], { env: { ...process.env, XRADAR_DATA: data, XRADAR_PORT: '18773', XRADAR_PUBLIC_PROXY: 'off' }, stdio: 'pipe', windowsHide: true });
    let ready = false;
    for (let n = 0; n < 50; n++) { try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {} await pause(150); }
    assert(ready);
  }
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.setDefaultTimeout(30000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/#x');
  await page.getByRole('heading', { name: /X 信号源/ }).waitFor();
  await page.locator('.progressbox').waitFor({ state: 'hidden', timeout: 180000 });
  assert.equal(await page.locator('.nav button').last().getAttribute('data-view'), 'skills');
  assert(await page.locator('.x-card').count() > 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (live) await page.waitForFunction(() => [...document.querySelectorAll('.x-account img')].some(img => img.complete && img.naturalWidth > 0), { timeout: 30000 });
  await page.screenshot({ path: path.join(qa, live ? 'x-source-live-desktop.png' : 'x-source-synthetic-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '长文 / 长帖', exact: true }).click();
  if (!live) assert(await page.locator('.x-card-grid').first().locator('.x-card').count() > 0);
  await page.locator('#x-filter-sort').selectOption('bookmarks');
  await page.locator('#x-filter-query').fill(live ? 'AI' : '合成');
  await pause(400);
  assert.equal(await page.locator('#x-filter-query').inputValue(), live ? 'AI' : '合成');
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  await page.locator('.x-card-title').first().click();
  await page.locator('#x-reader').waitFor();
  assert.equal(await page.locator('#x-reader').evaluate(el => el.open), true);
  if (!live) {
    assert((await page.locator('#x-reader').innerText()).includes('合成全文段落甲'));
    await page.getByRole('button', { name: '读取完整长文与串文', exact: true }).click();
    await page.locator('.progressbox').waitFor({ state: 'hidden' });
    assert((await page.locator('#x-reader').innerText()).includes('合成作者续帖二'));
  }
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '置顶参考', exact: true }).click();
  assert(await page.locator('.x-pin-card').count() > 0);
  if (live) {
    await page.locator('#x-filter-account').selectOption('AI_Jasonyu');
    assert((await page.locator('.x-card-title').first().textContent()).includes('一年涨粉6.3万'));
    await page.waitForFunction(() => [...document.querySelectorAll('.x-cover img')].some(img => img.complete && img.naturalWidth > 0), { timeout: 30000 });
    await page.screenshot({ path: path.join(qa, 'x-source-live-pinned.png'), fullPage: true });
    await page.locator('.x-card-title').first().click();
    assert((await page.locator('#x-reader').innerText()).includes('已取得长文正文'));
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  await page.getByRole('button', { name: '管理账号', exact: true }).click();
  assert.equal(await page.locator('#x-management').evaluate(el => el.open), true);
  assert(await page.locator('.x-account-report').count() >= 4);
  if (!live) {
    await page.locator('#x-add-handle').fill('@dotey');
    await page.getByRole('button', { name: '添加账号', exact: true }).click();
    await page.locator('#toast').filter({ hasText: '重复' }).waitFor();
    assert.equal(await page.locator('#x-add-handle').inputValue(), '@dotey');
    await page.locator('#x-add-handle').fill('https://x.com/NewAI'); await page.locator('#x-add-name').fill('新增观察账号');
    await page.getByRole('button', { name: '添加账号', exact: true }).click();
    await page.locator('.progressbox').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.x-account-report').count(), 5);
    const newAccount = page.locator('.x-account-report').filter({ hasText: '@NewAI' });
    await newAccount.getByRole('button', { name: '单独刷新', exact: true }).click();
    await page.locator('.progressbox').waitFor({ state: 'hidden' });
    await newAccount.getByRole('button', { name: '停用', exact: true }).click();
    await page.locator('.progressbox').waitFor({ state: 'hidden' });
    assert.equal(await newAccount.getByRole('button', { name: '启用', exact: true }).count(), 1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.querySelector('#x-management').open = false; window.scrollTo(0, 0); });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(qa, live ? 'x-source-live-mobile.png' : 'x-source-synthetic-mobile.png'), fullPage: true });
  await page.locator('.x-card-title').first().click();
  assert.equal(await page.locator('#x-reader').evaluate(el => el.getBoundingClientRect().width <= innerWidth), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#x-reader').evaluate(el => el.open), false);
  if (!live) {
    await page.request.post(base + '/api/settings', { headers: { Origin: base }, data: { textBase: 'https://example.com/v1', textModel: 'fixture', textKey: 'synthetic-browser-key' } });
    await page.reload(); await page.locator('.progressbox').waitFor({ state: 'hidden' });
    await page.locator('.x-card').first().getByRole('button', { name: '找选题 ↗', exact: true }).click();
    await page.getByRole('heading', { name: '隔离测试选题', exact: true }).waitFor();
    assert.equal(await page.locator('.nav button.active').getAttribute('data-view'), 'search');
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ ok: true, live, browserErrors: errors.length, checks: ['卡片、账号、时间和热度筛选', '引用/全文阅读与置顶', '技能入口保持最后', '390px 无页面溢出', '刷新恢复', ...(live ? ['真实鱼总置顶长文'] : ['管理账号增删停用', '作者串文', '单条生成选题'])], screenshots: qa }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once('exit', r)); } });
