export type Template = {
  id: string; name: string; industry: string; task: string; description: string;
  fields: { key: string; label: string; placeholder: string }[]; ratio: string; tone: string;
};

// Illustrative starting points, not tested prompts or generated examples.
export const templates: Template[] = [
  { id: 'still-life', name: '自然光产品展示', industry: '产品', task: '产品展示', description: '用安静自然的场景突出产品主体。', ratio: '4:5', tone: 'sage', fields: [{ key: 'subject', label: '产品', placeholder: '例如：玻璃精华液瓶' }, { key: 'setting', label: '场景', placeholder: '例如：浅色石材台面' }, { key: 'style', label: '氛围', placeholder: '例如：自然简洁' }] },
  { id: 'social', name: '值得分享的瞬间', industry: '品牌', task: '社交配图', description: '围绕简单的想法，营造有氛围的画面。', ratio: '1:1', tone: 'clay', fields: [{ key: 'subject', label: '主体', placeholder: '例如：清晨的咖啡时光' }, { key: 'setting', label: '场景', placeholder: '例如：阳光洒进的厨房' }, { key: 'style', label: '氛围', placeholder: '例如：温暖舒适' }] },
  { id: 'poster', name: '主题海报', industry: '品牌', task: '海报', description: '为活动或主题探索视觉方向。', ratio: '4:5', tone: 'ink', fields: [{ key: 'subject', label: '主体', placeholder: '例如：植物主题展览' }, { key: 'setting', label: '视觉元素', placeholder: '例如：醒目的植物造型' }, { key: 'style', label: '氛围', placeholder: '例如：富有表现力的杂志风格' }] },
  { id: 'character', name: '角色形象探索', industry: '创意', task: '角色设计', description: '从角色和其所处的世界开始探索。', ratio: '3:4', tone: 'sand', fields: [{ key: 'subject', label: '角色', placeholder: '例如：充满好奇心的森林探险家' }, { key: 'setting', label: '世界设定', placeholder: '例如：薄雾笼罩的树林' }, { key: 'style', label: '风格', placeholder: '例如：充满想象力的插画' }] },
];

export function buildPrompt(template: Template, values: Record<string, string>): string {
  const parts = template.fields.map(field => values[field.key]?.trim()).filter(Boolean);
  return parts.length ? `${parts.join('，')}。` : '';
}

export function filterTemplates(query: string, category: string): Template[] {
  const term = query.trim().toLowerCase();
  return templates.filter(template => (category === '全部' || template.industry === category || template.task === category) &&
    `${template.name} ${template.description} ${template.industry} ${template.task}`.toLowerCase().includes(term));
}
