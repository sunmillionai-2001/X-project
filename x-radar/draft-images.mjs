import { hash, requireValue, text } from './core.mjs';

export const promptHash = image => hash({ title: image.title, prompt: image.prompt });
export const promptBodyHash = draft => draft.imagesBodyHash || hash(draft.versions?.[0]?.body || draft.body);
export function currentDraftImage(draft, asset) {
  const image = draft.images[asset.imageIndex];
  return asset.draftId === draft.id && !!image && asset.draftHash === hash(draft.body) && asset.promptHash === promptHash(image);
}
export function validateDraftImages(images) {
  requireValue(Array.isArray(images) && images.length >= 2 && images.length <= 3, '配图方案需要 2—3 张图片');
  return images.map(i => {
    const title = text(i.title, 200).trim(), prompt = text(i.prompt, 5000).trim();
    requireValue(title && prompt, '图片标题和提示词不能为空'); return { title, prompt };
  });
}
export function imageSelection(draft, indices) {
  requireValue(promptBodyHash(draft) === hash(draft.body), '正文已修改，请先核对并保存配图提示词，再生成图片');
  const selected = indices === undefined ? draft.images.map((_, n) => n) : indices;
  requireValue(Array.isArray(selected) && selected.length >= 1 && selected.length <= draft.images.length && selected.every(n => Number.isInteger(n) && n >= 0 && n < draft.images.length) && new Set(selected).size === selected.length, '请选择有效且不重复的配图序号');
  return selected;
}
export function preparedDraftAssets(draft) {
  const selected = new Map();
  for (const a of draft.imageAssets || []) if (currentDraftImage(draft, a) && !selected.has(a.imageIndex)) selected.set(a.imageIndex, a);
  return [...selected.values()];
}
export function attachPreparedImages(project) {
  if (project.suggestedImagesBodyHash !== hash(project.draft)) return project;
  for (const asset of project.suggestedImageAssets || []) {
    const plan = project.plan?.[asset.imageIndex];
    if (!plan || plan.kind !== 'illustration' || asset.draftHash !== hash(project.draft) || asset.promptHash !== promptHash(plan)) continue;
    const old = project.assets.find(a => a.planId === plan.id && a.draftHash === asset.draftHash);
    if (old) {
      if (old.file === asset.file || old.draftId !== asset.draftId) continue;
      project.assets = project.assets.filter(a => a.id !== old.id);
    }
    project.assets.push({ ...asset, planId: plan.id });
  }
  return project;
}
