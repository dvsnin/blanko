import { describe, it, expect } from 'vitest';
import { TEMPLATES, TOPICS, AGES } from '../constants/templates';
import {
  templatesForAge, filterTemplates, topicCounts, templateById, topicStyle, ageLabel, coverForBoard,
} from './templates';

describe('реестр', () => {
  it('18 шаблонов, 8 тем, 4 возраста', () => {
    expect(TEMPLATES).toHaveLength(18);
    expect(TOPICS).toHaveLength(8);
    expect(AGES.map((a) => a.label)).toEqual(['3–4 года', '4–5 лет', '5–6 лет', '6–7 лет']);
  });
});

describe('templatesForAge', () => {
  it('только с нужным возрастом, до 5, в порядке реестра', () => {
    const r = templatesForAge('3-4');
    expect(r.length).toBeLessThanOrEqual(5);
    expect(r.every((t) => t.ages.includes('3-4'))).toBe(true);
    expect(r).toEqual(TEMPLATES.filter((t) => t.ages.includes('3-4')).slice(0, 5));
  });
  it('без возраста — первые 5', () => {
    expect(templatesForAge(undefined)).toEqual(TEMPLATES.slice(0, 5));
  });
});

describe('filterTemplates', () => {
  it('поиск по слову', () => {
    expect(filterTemplates('буква', 'all', 'all').map((t) => t.id)).toContain('letter');
  });
  it('возраст + тема', () => {
    const r = filterTemplates('', '6-7', 'math');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((t) => t.topic === 'math' && t.ages.includes('6-7'))).toBe(true);
  });
});

describe('topicCounts', () => {
  it('all = 18', () => {
    const c = topicCounts('', 'all');
    expect(c.all).toBe(18);
    expect(c.math).toBe(4);
  });
});

describe('lookups', () => {
  it('templateById', () => {
    expect(templateById('nope')).toBeUndefined();
    expect(templateById(undefined)).toBeUndefined();
    expect(templateById('letter')?.glyph).toBe('А');
  });
  it('topicStyle / ageLabel', () => {
    expect(topicStyle('literacy').label).toBe('Грамота');
    expect(ageLabel('4-5')).toBe('4–5 лет');
    expect(ageLabel(undefined)).toBeUndefined();
  });
});

describe('coverForBoard', () => {
  it('глиф и тема из шаблона', () => {
    const c = coverForBoard({ id: 'x', title: 'Счёт до 5', templateId: 'letter' });
    expect(c.glyph).toBe('А');
    expect(c.topic?.key).toBe('literacy');
  });
  it('неизвестный шаблон — как без шаблона', () => {
    const c = coverForBoard({ id: 'x', title: 'Счёт до 5', templateId: 'ghost' });
    expect(c.glyph).toBe('5');
    expect(c.topic).toBeUndefined();
  });
});

describe('поиск по названию темы', () => {
  it('«математика» находит 4 шаблона темы', () => {
    expect(filterTemplates('математика', 'all', 'all').length).toBe(4);
  });
  it('«речь» находит два речевых шаблона', () => {
    const r = filterTemplates('речь', 'all', 'all');
    expect(r).toHaveLength(2);
    expect(r.every((t) => t.topic === 'speech')).toBe(true);
  });
});
