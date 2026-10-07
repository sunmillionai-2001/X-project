import fs from 'node:fs/promises';
const dir = new URL('./low-follower-20261006/', import.meta.url);
const report = JSON.parse(await fs.readFile(new URL('original-page-check.json', dir), 'utf8'));
for (const page of report.pages) {
  if (!page.received) continue;
  const html = await fs.readFile(new URL(`x-${page.handle}.html`, dir), 'utf8');
  const pos = html.indexOf(`href="/${page.handle}/verified_followers"`);
  page.visibleFollowers = pos < 0 ? null : html.slice(pos, pos + 1600).split('</a>')[0].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(JSON.stringify({ handle: page.handle, visibleFollowers: page.visibleFollowers }));
}
await fs.writeFile(new URL('original-page-check.json', dir), JSON.stringify(report, null, 2) + '\n', 'utf8');
