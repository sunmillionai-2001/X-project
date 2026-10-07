import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../.agents/skills');
const packages = [
  { name: 'cheat-on-content', commit: 'a138d911880f6b7ef61df3015e1022eb8478baff', url: 'https://github.com/XBuilderLAB/cheat-on-content', license: 'MIT', skills: ['cheat-on-content'] },
  { name: 'dbskill', commit: 'a0e6fa356c58eca1a6e804c319ea7aac3db4a9af', url: 'https://github.com/dontbesilent2025/dbskill', license: 'CC BY-NC 4.0', skills: ['dbs', 'dbs-content', 'dbs-content-value', 'dbs-resonate', 'dbs-spread', 'dbs-ai-check'] },
];
const read = file => new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
function section(skill, heading, limit = 1800) {
  const content = read(path.join(ROOT, skill, 'SKILL.md'));
  const start = content.indexOf(heading);
  if (start < 0) throw Error(`内容方法章节缺失：${skill} ${heading}`);
  const next = content.indexOf('\n## ', start + heading.length);
  return content.slice(start, next < 0 ? undefined : next).slice(0, limit);
}
export function methodStatus() {
  return { adaptedFor: 'X 中文中长文图文', calibration: '未校准，不预测阅读量', blindPredictionEnabled: false,
    packages: packages.map(p => ({ ...p, enabled: p.skills.every(s => fs.existsSync(path.join(ROOT, s, 'SKILL.md'))) })) };
}
export function methodContext(stage) {
  if (!methodStatus().packages.every(p => p.enabled)) throw Error('内容方法安装不完整，请修复技能文件后重试');
  const sources = [
    { name: 'cheat-on-content', excerpt: section('cheat-on-content', '## 三条不可妥协原则', 1500) },
    { name: 'dbs-content-value', excerpt: section('dbs-content-value', '## 五个核心判断', 3600) },
  ];
  if (stage === 'draft' || stage === 'review') {
    sources.push({ name: 'dbs-resonate', excerpt: section('dbs-resonate', '## 核心原则', 1600) });
    sources.push({ name: 'dbs-content', excerpt: section('dbs-content', '### Phase 3：五维诊断', 2000) });
  }
  if (stage === 'review') sources.push({ name: 'dbs-ai-check', excerpt: section('dbs-ai-check', '### 报告规则', 600) });
  if (stage === 'research') {
    sources.push({ name: 'dbs-content', excerpt: section('dbs-content', '### Phase 3：五维诊断', 2000) });
    sources.push({ name: 'dbs-spread', excerpt: section('dbs-spread', '## 工作流程', 2800) });
  }
  const adaptation = read(path.join(HERE, 'content-methods.md'));
  return { stage, adaptation, sources,
    revision: createHash('sha256').update(JSON.stringify({ adaptation, sources })).digest('hex') };
}
