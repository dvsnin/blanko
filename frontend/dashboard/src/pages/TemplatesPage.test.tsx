import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import TemplatesPage from './TemplatesPage';
import { TeamsContext, type TeamsContextValue } from '../contexts/TeamsContext';
import { filterTemplates } from '../utils/templates';

const team = { id: 't1', name: 'Ромашки', role: 'owner', boards: [], isStarred: false, ageGroup: '4-5' };

function setup() {
  const value = {
    teams: [team], activeTeamId: 't1', activeTeam: team, activeBoards: [],
    loading: false, error: null, createBoard: vi.fn(), markBoardOpened: vi.fn(),
  } as unknown as TeamsContextValue;
  return render(
    <TeamsContext.Provider value={value}><TemplatesPage initialAge="6-7" /></TeamsContext.Provider>,
  );
}

const found = () => screen.getByText(/Найдено:/).textContent;

describe('TemplatesPage', () => {
  afterEach(cleanup);

  it('initialAge выбирает возраст и фильтрует', () => {
    setup();
    expect(screen.getByRole('button', { name: '6–7 лет' }).getAttribute('aria-pressed')).toBe('true');
    expect(found()).toBe(`Найдено: ${filterTemplates('', '6-7', 'all').length}`);
  });

  it('поиск «буква» оставляет одну карточку после сброса возраста', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Все возрасты' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Поиск/ }), { target: { value: 'буква' } });
    expect(found()).toBe('Найдено: 1');
    expect(screen.getAllByRole('button', { name: 'Создать доску' })).toHaveLength(1);
  });

  it('тема меняет счётчик, сброс возвращает 18', () => {
    setup();
    const before = found();
    fireEvent.click(screen.getByRole('button', { name: /Математика/ }));
    expect(found()).not.toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    expect(found()).toBe('Найдено: 18');
    expect(screen.queryByRole('button', { name: 'Сбросить фильтры' })).toBeNull();
  });

  it('«Как у группы» ставит возраст группы', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Как у группы «Ромашки»/ }));
    expect(screen.getByRole('button', { name: '4–5 лет' }).getAttribute('aria-pressed')).toBe('true');
  });
});
