import { describe, expect, it } from 'vitest';
import { buildPrompt, filterTemplates, templates } from './templates';

describe('template recipes', () => {
  it('filters by task or industry and searches Chinese text', () => {
    expect(filterTemplates('自然光', '产品').map(item => item.id)).toEqual(['still-life']);
    expect(filterTemplates('', '海报').map(item => item.id)).toEqual(['poster']);
    expect(filterTemplates('不存在的模板', '全部')).toEqual([]);
  });

  it('builds an editable prompt from filled fields without empty separators', () => {
    expect(buildPrompt(templates[0], { subject: '  精华液  ', setting: '', style: ' 柔和光线 ' })).toBe('精华液，柔和光线。');
    expect(buildPrompt(templates[0], {})).toBe('');
  });
});
