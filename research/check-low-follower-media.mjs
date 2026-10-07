import fs from 'node:fs/promises';
import { publicXImage } from '../x-radar/x-public-network.mjs';
const dir = new URL('./low-follower-20261006/', import.meta.url);
const { studies } = JSON.parse(await fs.readFile(new URL('verified.json', dir), 'utf8'));
const remote = async (url, options, max) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(options.timeout) }); if (!r.ok) throw Error(`HTTP ${r.status}`);
  const body = Buffer.from(await r.arrayBuffer()); if (body.length > max) throw Error('Image too large'); return { body };
};
const report = [];
for (const s of studies) {
  const p = s.post;
  const url = p.article?.cover_media?.media_info?.original_img_url || p.media?.photos?.[0]?.url || p.media?.videos?.[0]?.thumbnail_url;
  if (!url) continue;
  try {
    const bytes = await publicXImage(url, remote), file = `media-${p.author.screen_name}.jpg`;
    await fs.writeFile(new URL(file, dir), bytes);
    report.push({ handle: p.author.screen_name, url, file, bytes: bytes.length, scope: p.media?.videos?.length ? 'video_thumbnail_only' : p.article ? 'article_cover_only' : 'first_photo_only' });
    console.log(JSON.stringify(report.at(-1)));
  } catch (e) { report.push({ handle: p.author.screen_name, url, received: false, reason: e.message }); }
}
await fs.writeFile(new URL('media-check.json', dir), JSON.stringify(report, null, 2) + '\n', 'utf8');
