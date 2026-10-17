import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GroupHeader from './GroupHeader';
import type { Team } from '../types';

afterEach(cleanup);

const team = (over: Partial<Team> = {}): Team =>
  ({ id: 't1', name: 'Ромашки', role: 'owner', boards: [], ...over }) as Team;

const noop = () => {};
const base = { boardsCount: 2, onSettings: noop, onFromTemplate: noop, onCreateBoard: noop, onCreateTeam: noop };

describe('GroupHeader', () => {
  it('владелец без возраста: «Указать возраст» и «Настройки группы»', () => {
    render(<GroupHeader {...base} team={team()} role="owner" />);
    expect(screen.getByRole('button', { name: 'Указать возраст' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Настройки группы' })).toBeTruthy();
  });

  it('участник без возраста: текст и нет настроек', () => {
    render(<GroupHeader {...base} team={team({ role: 'member' })} role="member" />);
    expect(screen.getByText('Возраст не указан')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Настройки группы' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Указать возраст' })).toBeNull();
  });

  it('возраст группы показывается в meta', () => {
    render(<GroupHeader {...base} team={team({ ageGroup: '3-4' })} role="owner" />);
    expect(screen.getByText('3-4 года')).toBeTruthy();
  });

  it('team=null: «Создать группу» вызывает onCreateTeam', () => {
    const onCreateTeam = vi.fn();
    render(<GroupHeader {...base} team={null} role="member" onCreateTeam={onCreateTeam} />);
    fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
    expect(onCreateTeam).toHaveBeenCalledTimes(1);
  });

  it('«Из шаблона» вызывает onFromTemplate', () => {
    const onFromTemplate = vi.fn();
    render(<GroupHeader {...base} team={team({ role: 'member' })} role="member" onFromTemplate={onFromTemplate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Из шаблона' }));
    expect(onFromTemplate).toHaveBeenCalledTimes(1);
  });
});
