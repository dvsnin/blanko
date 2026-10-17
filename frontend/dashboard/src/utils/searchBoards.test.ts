import { describe, it, expect } from 'vitest';
import { matchesQuery, searchOtherTeams } from './searchBoards';
import type { Board, Team } from '../types';

const b = (id: string, title: string): Board => ({ id, publicId: id, title, owner: 'Анна', lastOpened: '' });
const t = (id: string, boards: Board[]): Team => ({ id, name: id, role: 'owner', boards, isStarred: false });

describe('matchesQuery', () => {
  it('ignores case', () => expect(matchesQuery('Счёт до 5', 'счёт')).toBe(true));
  it('empty query matches', () => expect(matchesQuery('Счёт', '')).toBe(true));
  it('trims query', () => expect(matchesQuery('Счёт', '  ')).toBe(true));
  it('no match', () => expect(matchesQuery('Счёт', 'буква')).toBe(false));
});

describe('searchOtherTeams', () => {
  const teams = [
    t('a', [b('1', 'Азбука')]),
    t('b', [b('2', 'Танграм'), b('3', 'Цифры')]),
    t('c', [b('4', 'Лото'), b('5', 'Сказка')]),
  ];
  it('returns matches from non-active teams with their team', () => {
    const r = searchOtherTeams(teams, 'a', 'а');
    expect(r.map((x) => [x.board.id, x.team.id])).toEqual([['2', 'b'], ['5', 'c']]);
  });
  it('single team -> []', () => expect(searchOtherTeams([teams[0]], 'a', 'а')).toEqual([]));
  it('empty query -> []', () => expect(searchOtherTeams(teams, 'a', '')).toEqual([]));
});
