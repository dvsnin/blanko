import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import TeamSwitcher from './TeamSwitcher';
import { TeamsContext, type TeamsContextValue } from '../contexts/TeamsContext';
import type { Team } from '../types';

const mk = (id: string, name: string, isStarred = false, extra: Partial<Team> = {}): Team => ({
  id, name, role: 'owner', boards: [], isStarred, ...extra,
});

function fake(teams: Team[], over: Partial<TeamsContextValue> = {}): TeamsContextValue {
  const activeTeam = teams[0] ?? null;
  return {
    teams, activeTeamId: activeTeam?.id ?? null, activeTeam, activeBoards: [],
    loading: false, error: null,
    setActiveTeamId: vi.fn(), createTeam: vi.fn(), updateTeam: vi.fn(), deleteTeam: vi.fn(),
    leaveTeam: vi.fn(), toggleStarTeam: vi.fn(), createBoard: vi.fn(), renameBoard: vi.fn(),
    deleteBoard: vi.fn(), toggleStarBoard: vi.fn(), refresh: vi.fn(),
    ...over,
  } as TeamsContextValue;
}

const teams = [
  mk('t-alpha', 'Альфа'),
  mk('t-rom', 'Ромашки'),
  mk('t-cham', 'Ягодки', true, { ageGroup: '4-5', boardCount: 2 }),
];

function setup(value: TeamsContextValue) {
  return render(
    <TeamsContext.Provider value={value}><TeamSwitcher /></TeamsContext.Provider>,
  );
}

describe('TeamSwitcher', () => {
  afterEach(cleanup);

  it('триггер показывает имя активной группы', () => {
    setup(fake(teams));
    const trigger = screen.getByRole('button', { name: /Альфа/ });
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('клик открывает listbox, избранная первой', () => {
    setup(fake(teams));
    fireEvent.click(screen.getByRole('button', { name: /Альфа/ }));
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(3);
    expect(opts[0].textContent).toContain('Ягодки');
    expect(opts[0].textContent).toContain('4–5 лет · 0 досок');
  });

  it('поиск «ром» оставляет одну группу', () => {
    setup(fake(teams));
    fireEvent.click(screen.getByRole('button', { name: /Альфа/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ром' } });
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(1);
    expect(opts[0].textContent).toContain('Ромашки');
  });

  it('клик по строке вызывает setActiveTeamId', () => {
    const v = fake(teams);
    setup(v);
    fireEvent.click(screen.getByRole('button', { name: /Альфа/ }));
    fireEvent.click(screen.getAllByRole('option')[0]);
    expect(v.setActiveTeamId).toHaveBeenCalledWith('t-cham');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('клавиатура: стрелка вниз + Enter', () => {
    const v = fake(teams);
    setup(v);
    fireEvent.click(screen.getByRole('button', { name: /Альфа/ }));
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(v.setActiveTeamId).toHaveBeenCalledWith('t-alpha');
  });

  it('Escape закрывает', () => {
    setup(fake(teams));
    fireEvent.click(screen.getByRole('button', { name: /Альфа/ }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('клик снаружи закрывает', () => {
    setup(fake(teams));
    fireEvent.click(screen.getByRole('button', { name: /Альфа/ }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('при teams=[] рендерится «Создать группу»', () => {
    setup(fake([]));
    expect(screen.getByRole('button', { name: 'Создать группу' })).toBeTruthy();
  });
});
