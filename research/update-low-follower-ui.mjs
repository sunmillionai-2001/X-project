import fs from 'node:fs';
const file = new URL('../x-radar/web/growth-view.js', import.meta.url);
let source = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
const replacements = [
  ["作者文字已取得')} · 图片未分析</small>", "作者文字已取得')} · ${e(r.analysisScope || '图片未分析')}</small>"],
  ["作者文字'}；图片未分析。</li>", "作者文字'}；${e(a.reference.analysisScope || '图片未分析')}。</li>"]
];
for (const [before, after] of replacements) {
  if (source.split(before).length !== 2) throw Error('Expected a single matching UI fragment');
  source = source.replace(before, after);
}
fs.writeFileSync(file, source, 'utf8');
console.log('Curated media scope now appears in the creation view.');
