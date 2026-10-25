import { describe, it, expect } from 'vitest';
import { TOPICS, AGES } from '../constants/templates';
import { filterTemplates, topicCounts, topicStyle, ageLabel, coverForBoard } from './templates';
import { FIXTURE } from './templates.fixture';


describe('константы', () => {
  it('8 тем, 4 возраста', () => {
    expect(TOPICS).toHaveLength(12);
    expect(AGES.map((a) => a.label)).toEqual(['3-4 года', '4-5 лет', '5-6 лет', '6-7 лет']);
  });
});

describe('filterTemplates', () => {
  it('по слову из названия и описания', () => {
    expect(filterTemplates(FIXTURE, 'буква', 'all', 'all').map((t) => t.id)).toEqual(['t2']);
    expect(filterTemplates(FIXTURE, 'корзину', 'all', 'all').map((t) => t.id)).toEqual(['t1']);
  });
  it('по имени автора', () => {
    expect(filterTemplates(FIXTURE, 'петрова', 'all', 'all').map((t) => t.id)).toEqual(['t2']);
  });
  it('по названию темы', () => {
    expect(filterTemplates(FIXTURE, 'логика', 'all', 'all').map((t) => t.id)).toEqual(['t4']);
  });
  it('по возрасту и теме', () => {
    expect(filterTemplates(FIXTURE, '', '3-4', 'all').map((t) => t.id)).toEqual(['t1', 't3']);
    expect(filterTemplates(FIXTURE, '', '3-4', 'world').map((t) => t.id)).toEqual(['t3']);
  });
});

describe('topicCounts', () => {
  it('учитывает возраст и поиск', () => {
    const c = topicCounts(FIXTURE, '', 'all');
    expect(c.all).toBe(4);
    expect(c.math).toBe(1);
    expect(topicCounts(FIXTURE, '', '6-7').all).toBe(2);
    expect(topicCounts(FIXTURE, 'буква', 'all').literacy).toBe(1);
  });
});

describe('lookups', () => {
  it('topicStyle / ageLabel', () => {
    expect(topicStyle('literacy').label).toBe('Грамота');
    expect(ageLabel('4-5')).toBe('4-5 лет');
    expect(ageLabel(undefined)).toBeUndefined();
  });
});

describe('coverForBoard', () => {
  it('тема из шаблона, буква всегда из названия доски', () => {
    const c = coverForBoard({ id: 'x', title: 'Теремок', templateId: 't2' }, FIXTURE[1]);
    expect(c.glyph).toBe('Т');
    expect(c.topic?.key).toBe('literacy');
  });
  it('без шаблона (удалён или нет) - базовая обложка', () => {
    const c = coverForBoard({ id: 'x', title: 'Счёт до 5', templateId: 'ghost' });
    expect(c.glyph).toBe('5');
    expect(c.topic).toBeUndefined();
  });
});
