import { describe, it, expect } from 'vitest';
import { formatRelative } from './relativeTime';

const now = new Date(2026, 9, 17, 12, 0);
const at = (d: number, h = 10, m = 20, month = 9) => new Date(2026, month, d, h, m).toISOString();

describe('formatRelative', () => {
  it('меньше минуты -> только что', () => expect(formatRelative(new Date(2026, 9, 17, 11, 59, 30).toISOString(), now)).toBe('только что'));
  it('тот же день -> сегодня, HH:MM', () => expect(formatRelative(at(17, 9, 5), now)).toBe('сегодня, 09:05'));
  it('предыдущий день -> вчера', () => expect(formatRelative(at(16), now)).toBe('вчера'));
  it('граница суток: вчера 23:50 при 00:10 -> вчера', () => expect(formatRelative(new Date(2026, 9, 16, 23, 50).toISOString(), new Date(2026, 9, 17, 0, 10))).toBe('вчера'));
  it.each([[15, '2 дня назад'], [14, '3 дня назад'], [13, '4 дня назад'], [12, '5 дней назад'], [11, '6 дней назад']])('день %i', (d, s) => expect(formatRelative(at(d), now)).toBe(s));
  it.each([[10, 'неделю назад'], [4, 'неделю назад'], [3, '2 недели назад'], [1, '2 недели назад']])('день %i -> %s', (d, s) => expect(formatRelative(at(d), now)).toBe(s));
  it('27 дней -> 3 недели назад', () => expect(formatRelative(at(20, 10, 20, 8), now)).toBe('3 недели назад'));
  it('29 дней -> 4 недели назад', () => expect(formatRelative(at(18, 10, 20, 8), now)).toBe('4 недели назад'));
  it('30 дней и больше -> D месяца', () => expect(formatRelative(at(17, 10, 20, 8), now)).toBe('17 сентября'));
  it('будущая метка (+2 дня) -> только что', () => expect(formatRelative(at(19), now)).toBe('только что'));
  it('граница 60 с: 59 с -> только что, 60 с -> сегодня, HH:MM', () => {
    expect(formatRelative(new Date(2026, 9, 17, 11, 59, 1).toISOString(), now)).toBe('только что');
    expect(formatRelative(new Date(2026, 9, 17, 11, 59, 0).toISOString(), now)).toBe('сегодня, 11:59');
  });
  it('невалидная -> пустая строка', () => { expect(formatRelative('nope', now)).toBe(''); expect(formatRelative(undefined, now)).toBe(''); });
});
