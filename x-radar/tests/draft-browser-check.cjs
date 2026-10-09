const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const bundled = createRequire(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json'));
const { chromium } = bundled('playwright');
const base = 'http://127.0.0.1:18906';
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'x-draft-browser-'));
const qa = path.resolve(__dirname, '../../research/qa-x-draft'); fs.mkdirSync(qa, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let child, browser;
async function request(route, input) {
  const r = await fetch(base + route, input === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(input) });
  const output = await r.json(); assert(r.ok, output.error); return output;
}
async function job(route, input) {
  let j = await request(route, input);
  while (j.status === 'running') { await pause(40); j = await request('/api/job/' + j.id); }
  assert.equal(j.status, 'done', j.error); return j.result;
}
(async () => {
  child = spawn(process.execPath, ['--import', pathToFileURL(path.join(__dirname, 'mock-network.mjs')).href, path.join(__dirname, '../server.mjs')], {
    env: { ...process.env, XRADAR_DATA: data, XRADAR_PORT: '18906', XRADAR_PUBLIC_PROXY: 'off' }, windowsHide: true, stdio: 'pipe'
  });
  let ready = false;
  for (let n = 0; n < 50; n++) { try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {} await pause(150); }
  assert(ready);
  await request('/api/settings', { textBase: 'https://example.com/v1', textModel: 'fixture-short-draft', textKey: 'isolated-browser-test-key' });
  const daily = await job('/api/recommend', {});
  let p = await request('/api/project', { cardId: daily.cards[0].id });
  p = await request('/api/outline', { id: p.id, revision: p.revision, angle: p.angle, outline: p.outline });
  p = await request('/api/test', { id: p.id, revision: p.revision, notes: '浏览器隔离验收用合成实测记录，不是真实文章内容或用户体验。' });
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(id => { sessionStorage.setItem('radar-project', id); sessionStorage.setItem('radar-view', 'project'); }, p.id);
  await page.goto(base + '/#project');
  await page.getByRole('button', { name: '生成正文初稿', exact: true }).click();
  await page.locator('#draft-length-note [data-action="adjust-draft"]').waitFor();
  const short = await page.locator('#draft').inputValue(); assert(short.length > 0 && short.length < 800);
  assert((await page.locator('#draft-length-note').innerText()).includes([...short].length + ' 字符'));
  assert((await page.locator('#toast').innerText()).includes('初稿已保存'));
  assert.equal(await page.getByRole('button', { name: '扩写到建议字数', exact: true }).count(), 1);
  await page.screenshot({ path: path.join(qa, 'draft-short.png') });

  await page.getByRole('button', { name: '扩写到建议字数', exact: true }).click();
  await page.locator('#draft-length-note [data-action="adjust-draft"]').waitFor({ state: 'hidden' });
  assert([...(await page.locator('#draft').inputValue())].length >= 800);
  assert((await page.locator('.history > summary').innerText()).includes('2 个版本'));

  const manual = '尚未保存的手改内容。'.repeat(10) + '😊';
  await page.locator('#draft').fill(manual);
  assert.equal(Number(await page.locator('#char-count').innerText()), [...manual].length);
  assert((await page.locator('#draft-length-note').innerText()).includes([...manual].length + ' 字符'));
  await page.getByRole('button', { name: '扩写到建议字数', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.progressbox') && document.querySelector('.history > summary')?.textContent.includes('4 个版本'));
  await page.locator('#draft-length-note [data-action="adjust-draft"]').waitFor({ state: 'hidden' });
  const saved = (await request('/api/state')).projects.find(item => item.id === p.id);
  assert.equal(saved.versions.length, 4); assert.equal(saved.versions.at(-2).body, manual);

  await page.locator('#draft').fill('字'.repeat(800));
  assert.equal(await page.locator('#draft-length-note [data-action="adjust-draft"]').count(), 0);
  await page.locator('#draft').fill('字'.repeat(1500) + '😊');
  assert.equal(await page.getByRole('button', { name: '精简到建议字数', exact: true }).count(), 1);
  assert((await page.locator('#draft-length-note').innerText()).includes('1501 字符'));
  await page.reload();
  assert.equal(await page.locator('#draft').inputValue(), saved.draft);

  await request('/api/settings', { textModel: 'fixture-long-draft' });
  await page.getByRole('button', { name: '重新生成初稿', exact: true }).click();
  await page.getByRole('button', { name: '精简到建议字数', exact: true }).waitFor();
  const long = await page.locator('#draft').inputValue(); assert([...long].length > 1500);
  await request('/api/settings', { textModel: 'fixture-empty-draft' });
  await page.getByRole('button', { name: '重新生成初稿', exact: true }).click();
  await page.locator('#toast').filter({ hasText: '空正文' }).waitFor();
  assert.equal(await page.locator('#draft').inputValue(), long);
  await page.reload();
  assert.equal(await page.locator('#draft').inputValue(), long);
  await page.screenshot({ path: path.join(qa, 'draft-long.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#draft-length-note').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(qa, 'draft-mobile.png') });
  assert.deepEqual(errors, []);
  console.log('Draft browser acceptance passed: retained short/long output, exact count, explicit adjustment, unsaved edits, version history, blank-result preservation, refresh and mobile.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (child?.exitCode === null) child.kill(); });
