import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import { UserContext, type UserContextValue } from '../contexts/UserContext';
import { TeamsContext, type TeamsContextValue } from '../contexts/TeamsContext';
import type { Team } from '../types';

const mk = (id: string, name: string, role: Team['role']): Team => ({
  id, name, role, boards: [], isStarred: false,
});

function setup(teams: Team[] = [mk('a', 'Альфа', 'owner'), mk('b', 'Бета', 'admin'), mk('c', 'Гамма', 'member')]) {
  const updateName = vi.fn().mockResolvedValue(undefined);
  const user = {
    user: { id: 'u1', name: 'Иван Петров', email: 'ivan@example.com' },
    setUser: vi.fn(), updateName, userInitial: 'И', workspaceName: 'Иван Петров',
  } as UserContextValue;
  const tv = { teams, setActiveTeamId: vi.fn() } as unknown as TeamsContextValue;
  render(
    <UserContext.Provider value={user}>
      <TeamsContext.Provider value={tv}><ProfilePage /></TeamsContext.Provider>
    </UserContext.Provider>,
  );
  return { updateName, tv };
}

describe('ProfilePage', () => {
  afterEach(cleanup);

  it('поле имени заполнено', () => {
    setup();
    expect((screen.getByLabelText('Имя') as HTMLInputElement).value).toBe('Иван Петров');
  });

  it('почта только для чтения', () => {
    setup();
    const email = screen.getByLabelText('Электронная почта') as HTMLInputElement;
    expect(email.value).toBe('ivan@example.com');
    expect(email.readOnly).toBe(true);
  });

  it('сохранение вызывает updateName', async () => {
    const { updateName } = setup();
    const save = screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Новое имя' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(updateName).toHaveBeenCalledWith('Новое имя'));
    await screen.findByText('Имя сохранено');
  });

  it('«Мои группы» с ролями', () => {
    setup();
    expect(screen.getByText('Альфа')).toBeTruthy();
    expect(screen.getByText('Владелец')).toBeTruthy();
    expect(screen.getByText('Администратор')).toBeTruthy();
    expect(screen.getByText('Участник')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Открыть' })).toHaveLength(3);
  });
});
