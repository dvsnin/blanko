import { describe, it, expect } from 'vitest';
import type { Board } from '../types';
import { assignColors } from './colors';
import { COVER_KEYS, colorForId, hashString } from './cover';

const mk = (id: string) => ({ id, title: id, owner: 'o' }) as unknown as Board;

function sameBucket(count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; ids.length < count && i < 100000; i++) {
    if (hashString(String(i)) % 12 === 0) ids.push(String(i));
  }
  return ids;
}

const toMap = (l: Board[]) => Object.fromEntries(l.map((b) => [b.id, b.colorKey]));

describe('assignColors', () => {
  it('12 досок из одной корзины получают 12 разных цветов', () => {
    const ids = sameBucket(12);
    expect(ids).toHaveLength(12);
    const keys = assignColors(ids.map(mk)).map((b) => b.colorKey);
    expect(new Set(keys).size).toBe(12);
  });

  it('результат не зависит от порядка входа', () => {
    const ids = [...sameBucket(6), 'a', 'b', 'c', 'd'];
    const base = toMap(assignColors(ids.map(mk)));
    expect(toMap(assignColors([...ids].reverse().map(mk)))).toEqual(base);
    const shuffled = [...ids.slice(5), ...ids.slice(0, 5)];
    expect(toMap(assignColors(shuffled.map(mk)))).toEqual(base);
  });

  it('сохраняет исходный порядок списка', () => {
    const out = assignColors(['z', 'a', 'm'].map(mk));
    expect(out.map((b) => b.id)).toEqual(['z', 'a', 'm']);
  });

  it('одна доска сохраняет colorForId', () => {
    expect(assignColors([mk('abc')])[0].colorKey).toBe(colorForId('abc'));
  });

  it('13 досок: есть повтор, но каждый цвет использован', () => {
    const keys = assignColors(Array.from({ length: 13 }, (_, i) => mk(`b${i}`))).map((b) => b.colorKey);
    expect(new Set(keys).size).toBe(12);
    expect(keys.every((k) => (COVER_KEYS as readonly string[]).includes(k as string))).toBe(true);
  });
});
