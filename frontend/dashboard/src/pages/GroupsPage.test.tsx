import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import GroupsPage from './GroupsPage';
import { TeamsContext, type TeamsContextValue } from '../contexts/TeamsContext';
import type { Board, Team } from '../types';

const board = (i: number): Board => ({
  id: `b${i}`, publicId: `p${i}`, title: `Доска ${i}`, owner: 'x', lastOpened: '',
  lastOpenedAt: new Date(2026, 9, 17 - i).toISOString(),
});
const boards = (n: number) => Array.from({ length: n }, (_, i) => board(i + 1));

const mk = (id: string, name: string, role: Team['role'], isStarred = false, n = 0): Team => ({
  id, name, role, boards: boards(n), isStarred,
});

function fake(teams: Team[], activeTeamId: string | null = null): TeamsContextValue {
  return {
    teams, activeTeamId, activeTeam: null, activeBoards: [],
    loading: false, error: null,
    setActiveTeamId: vi.fn(), createTeam: vi.fn(), updateTeam: vi.fn(), deleteTeam: vi.fn(),
    leaveTeam: vi.fn(), toggleStarTeam: vi.fn(), createBoard: vi.fn(), renameBoard: vi.fn(),
    deleteBoard: vi.fn(), toggleStarBoard: vi.fn(), markBoardOpened: vi.fn(), refresh: vi.fn(),
  } as TeamsContextValue;
}

const teams = [
  mk('t-b', 'Бета', 'admin', false, 2),
  mk('t-a', 'Альфа', 'member', false, 5),
  mk('t-s', 'Ягодки', 'owner', true, 0),
];

function setup(value: TeamsContextValue) {
  return render(<TeamsContext.Provider value={value}><GroupsPage /></TeamsContext.Provider>);
}

const cardOf = (name: string) =>
  screen.getByText(name, { selector: '.group-card__name-text' }).closest('.group-card') as HTMLElement;

describe('GroupsPage', () => {
  afterEach(cleanup);

  it('три карточки и «Новая группа», подзаголовок «3 группы · 7 досок»', () => {
    const { container } = setup(fake(teams));
    expect(container.querySelectorAll('.group-card')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Новая группа/ })).toBeTruthy();
    expect(screen.getByText('3 группы · 7 досок')).toBeTruthy();
  });

  it('текущая группа первой и с чипом «ТЕКУЩАЯ»', () => {
    const { container } = setup(fake(teams, 't-b'));
    const names = [...container.querySelectorAll('.group-card__name-text')].map((n) => n.textContent);
    expect(names).toEqual(['Бета', 'Ягодки', 'Альфа']);
    expect(within(cardOf('Бета')).getByText('ТЕКУЩАЯ')).toBeTruthy();
    expect(screen.getAllByText('ТЕКУЩАЯ')).toHaveLength(1);
  });

  it('клик по карточке выбирает группу и ведёт на доски', () => {
    const v = fake(teams);
    setup(v);
    fireEvent.click(within(cardOf('Бета')).getByText('Бета').closest('button')!);
    expect(v.setActiveTeamId).toHaveBeenCalledWith('t-b');
    expect(location.hash).toBe('#/');
  });

  it('поиск фильтрует по названию', () => {
    setup(fake(teams));
    fireEvent.change(screen.getByPlaceholderText('Найти группу…'), { target: { value: 'аль' } });
    expect(screen.getByText('Альфа')).toBeTruthy();
    expect(screen.queryByText('Бета')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Найти группу…'), { target: { value: 'яяя' } });
    expect(screen.getByText('Групп с таким названием нет')).toBeTruthy();
  });

  it('«⋯»: «Настройки группы» у владельца есть, у участника нет', () => {
    setup(fake(teams));
    fireEvent.click(within(cardOf('Ягодки')).getByRole('button', { name: 'Действия с группой' }));
    expect(within(cardOf('Ягодки')).getByRole('menuitem', { name: 'Настройки группы' })).toBeTruthy();
    expect(within(cardOf('Ягодки')).queryByRole('menuitem', { name: 'Покинуть группу' })).toBeNull();
    cleanup();
    setup(fake(teams));
    fireEvent.click(within(cardOf('Альфа')).getByRole('button', { name: 'Действия с группой' }));
    expect(within(cardOf('Альфа')).queryByRole('menuitem', { name: 'Настройки группы' })).toBeNull();
    expect(within(cardOf('Альфа')).getByRole('menuitem', { name: 'Покинуть группу' })).toBeTruthy();
  });

  it('показывает три последние доски и «и ещё 2 доски»', () => {
    setup(fake(teams));
    const card = cardOf('Альфа');
    expect(card.querySelectorAll('.group-card__row')).toHaveLength(3);
    expect(within(card).getByText('Доска 1')).toBeTruthy();
    expect(within(card).queryByText('Доска 4')).toBeNull();
    expect(within(card).getByText('и ещё 2 доски')).toBeTruthy();
  });

  it('пустая группа: «Досок пока нет»', () => {
    setup(fake(teams));
    expect(within(cardOf('Ягодки')).getByText('Досок пока нет')).toBeTruthy();
  });
});
