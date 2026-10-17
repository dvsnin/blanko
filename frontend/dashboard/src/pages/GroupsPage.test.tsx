import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import GroupsPage from './GroupsPage';
import { TeamsContext, type TeamsContextValue } from '../contexts/TeamsContext';
import type { Team } from '../types';

const mk = (id: string, name: string, role: Team['role'], isStarred = false): Team => ({
  id, name, role, boards: [], isStarred,
});

function fake(teams: Team[]): TeamsContextValue {
  return {
    teams, activeTeamId: null, activeTeam: null, activeBoards: [],
    loading: false, error: null,
    setActiveTeamId: vi.fn(), createTeam: vi.fn(), updateTeam: vi.fn(), deleteTeam: vi.fn(),
    leaveTeam: vi.fn(), toggleStarTeam: vi.fn(), createBoard: vi.fn(), renameBoard: vi.fn(),
    deleteBoard: vi.fn(), toggleStarBoard: vi.fn(), markBoardOpened: vi.fn(), refresh: vi.fn(),
  } as TeamsContextValue;
}

const teams = [
  mk('t-b', 'Бета', 'admin'),
  mk('t-a', 'Альфа', 'member'),
  mk('t-s', 'Ягодки', 'owner', true),
];

function setup(value: TeamsContextValue) {
  return render(<TeamsContext.Provider value={value}><GroupsPage /></TeamsContext.Provider>);
}

const cardOf = (name: string) =>
  screen.getByRole('heading', { name }).closest('.groups-card') as HTMLElement;

describe('GroupsPage', () => {
  afterEach(cleanup);

  it('три карточки и «Новая группа», подзаголовок «3 группы»', () => {
    setup(fake(teams));
    expect(screen.getAllByRole('button', { name: 'Открыть доски' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Новая группа/ })).toBeTruthy();
    expect(screen.getByText('3 группы')).toBeTruthy();
  });

  it('избранная первой, остальные по алфавиту', () => {
    setup(fake(teams));
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(['Ягодки', 'Альфа', 'Бета']);
  });

  it('«Открыть доски» выбирает группу и ведёт на доски', () => {
    const v = fake(teams);
    setup(v);
    fireEvent.click(within(cardOf('Бета')).getByRole('button', { name: 'Открыть доски' }));
    expect(v.setActiveTeamId).toHaveBeenCalledWith('t-b');
    expect(location.hash).toBe('#/');
  });

  it('шестерёнка только у владельца и администратора', () => {
    setup(fake(teams));
    const gear = (n: string) => within(cardOf(n)).queryByRole('button', { name: 'Настройки группы' });
    expect(gear('Ягодки')).toBeTruthy();
    expect(gear('Бета')).toBeTruthy();
    expect(gear('Альфа')).toBeNull();
  });
});
