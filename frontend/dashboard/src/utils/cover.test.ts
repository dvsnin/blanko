import { describe, it, expect } from 'vitest';
import { COVER_KEYS, hashString, colorForId, glyphFromTitle, coverFor, initialsOf } from './cover';

describe('glyphFromTitle', () => {
  it.each([
    ['Счёт до 5 с яблоками', '5'],
    ['Счёт до 100', '10'],
    ['Прогулка в парк', 'П'],
    ['И снова осень', 'С'],
    ['Новая доска', 'Н'],
    ['«Репка»: кто за кем', 'Р'],
    ['И', 'Д'],
    ['…', 'Д'],
    ['', 'Д'],
  ])('%s → %s', (title, glyph) => expect(glyphFromTitle(title)).toBe(glyph));
});

describe('hashString / colorForId', () => {
  it('стабилен', () => expect(hashString('abc')).toBe(hashString('abc')));
  it('возвращает uint32', () => { const h = hashString('x'); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThanOrEqual(0xffffffff); });
  it('пустой id → первый ключ', () => expect(colorForId('')).toBe(COVER_KEYS[0]));
  it('id 1…20 дают не меньше 7 разных цветов', () => {
    const keys = new Set(Array.from({ length: 20 }, (_, i) => colorForId(String(i + 1))));
    expect(keys.size).toBeGreaterThanOrEqual(7);
  });
  it('id 1…1000: каждый цвет получает от 5% до 12%', () => {
    const counts = new Map<string, number>();
    for (let i = 1; i <= 1000; i++) { const k = colorForId(String(i)); counts.set(k, (counts.get(k) ?? 0) + 1); }
    expect(counts.size).toBe(12);
    for (const n of counts.values()) { expect(n).toBeGreaterThanOrEqual(50); expect(n).toBeLessThanOrEqual(120); }
  });
});

describe('coverFor', () => {
  it('детерминирован и собирает поля', () => {
    const a = coverFor({ id: 'b1', title: 'Счёт до 5' });
    expect(a).toEqual(coverFor({ id: 'b1', title: 'Счёт до 5' }));
    expect(COVER_KEYS).toContain(a.colorKey);
    expect(['circle', 'square', 'triangle']).toContain(a.shape);
    expect([0, 1, 2, 3]).toContain(a.corner);
    expect(a.glyph).toBe('5');
  });
  it('фигура и угол берутся из других битов, чем цвет', () => {
    const h = hashString('b1');
    const c = coverFor({ id: 'b1', title: 'x' });
    expect(c.colorKey).toBe(COVER_KEYS[h % 12]);
    expect(c.shape).toBe((['circle', 'square', 'triangle'] as const)[(h >>> 8) % 3]);
    expect(c.corner).toBe((h >>> 16) % 4);
  });
});

describe('coverFor colorKey', () => {
  it('использует валидный colorKey', () => expect(coverFor({ id: 'x', title: 't', colorKey: 'rose' }).colorKey).toBe('rose'));
  it('невалидный colorKey → хэш', () => expect(coverFor({ id: 'x', title: 't', colorKey: 'nope' }).colorKey).toBe(COVER_KEYS[hashString('x') % 12]));
});

describe('initialsOf', () => {
  it.each([['Анна Петрова', 'АП'], ['анна', 'А'], ['Анна Мария Петрова', 'АМ'], ['', '']])('%s → %s', (n, r) => expect(initialsOf(n)).toBe(r));
});
