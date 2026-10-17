import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import TemplatesPage from './TemplatesPage';
import { TeamsContext, type TeamsContextValue } from '../contexts/TeamsContext';
import { TemplatesContext, EMPTY_TEMPLATES, type TemplatesContextValue } from '../contexts/TemplatesContext';
import { FIXTURE } from '../utils/templates.fixture';
import type { Board, Team } from '../types';

const boardFromT1: Board = {
  id: 'b1', publicId: 'pb1', title: 'Счёт до 5 с яблоками', owner: 'x', lastOpened: '',
  templateId: 't1', createdAt: '2026-10-10T00:00:00Z',
};
const team = { id: 'g1', name: 'Ромашки', role: 'owner', boards: [boardFromT1], isStarred: false, ageGroup: '3-4' } as Team;

function setup(opts: { team?: Team | null; templates?: typeof FIXTURE; loading?: boolean; error?: string | null } = {}) {
  const t = opts.team === undefined ? team : opts.team;
  const teams = {
    teams: t ? [t] : [], activeTeamId: t?.id ?? null, activeTeam: t, activeBoards: t?.boards ?? [],
    loading: false, error: null, createBoard: vi.fn().mockResolvedValue(null), markBoardOpened: vi.fn(),
  } as unknown as TeamsContextValue;
  const tpls: TemplatesContextValue = {
    ...EMPTY_TEMPLATES,
    templates: opts.templates ?? FIXTURE,
    loading: opts.loading ?? false,
    error: opts.error ?? null,
    refresh: vi.fn().mockResolvedValue(undefined),
    byId: (id?: string) => (opts.templates ?? FIXTURE).find((x) => x.id === id),
    toggleStarTemplate: vi.fn().mockResolvedValue(undefined),
    duplicateTemplate: vi.fn().mockResolvedValue(FIXTURE[0]),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
    updateTemplate: vi.fn().mockResolvedValue(undefined),
    createTemplate: vi.fn().mockResolvedValue(FIXTURE[0]),
  };
  render(
    <TeamsContext.Provider value={teams}>
      <TemplatesContext.Provider value={tpls}>
        <TemplatesPage />
      </TemplatesContext.Provider>
    </TeamsContext.Provider>,
  );
  return { teams, tpls };
}

const found = () => screen.getByText(/Найдено:/).textContent;
const cardOf = (name: string) =>
  screen.getByText(name, { selector: '.tpl-card__title' }).closest('.tpl-card') as HTMLElement;

describe('TemplatesPage', () => {
  afterEach(cleanup);

  it('избранные идут первыми, остальные по порядку списка', () => {
    setup();
    const names = [...document.querySelectorAll('.tpl-card__title')].map((n) => n.textContent);
    expect(names).toEqual(['Времена года', 'Счёт до 5 с яблоками', 'Буква и слова на неё', 'Что лишнее']);
    expect(screen.queryByText('Избранные и недавние')).toBeNull();
  });

  it('«Создать шаблон» открывает карточку и создаёт шаблон', async () => {
    const { tpls } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Создать шаблон' }));
    const dialog = screen.getByRole('dialog', { name: 'Новый шаблон' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'Моё занятие' } });
    // возраст группы (3-4) предзаполнен; добавляем второй
    fireEvent.click(within(dialog).getByRole('button', { name: '4-5 лет' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить шаблон' }));
    await waitFor(() => expect(tpls.createTemplate).toHaveBeenCalled());
    expect((tpls.createTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ name: 'Моё занятие', ages: ['3-4', '4-5'] });
    expect((tpls.createTemplate as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBeUndefined();
  });

  it('пилюля возраста группы помечена «как у группы»', () => {
    setup();
    expect(screen.getByRole('button', { name: /3-4 года/ }).textContent).toContain('как у группы');
    expect(screen.getByRole('button', { name: /4-5 лет/ }).textContent).not.toContain('как у группы');
  });

  it('меню «⋯»: «Редактировать» и «Удалить шаблон» только при canEdit', () => {
    setup();
    fireEvent.click(within(cardOf('Буква и слова на неё')).getByRole('button', { name: 'Действия с шаблоном' }));
    expect(screen.getByRole('menuitem', { name: 'Редактировать' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Удалить шаблон' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Дублировать' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /избранно/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Скопировать к себе' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(within(cardOf('Счёт до 5 с яблоками')).getByRole('button', { name: 'Действия с шаблоном' }));
    expect(screen.queryByRole('menuitem', { name: 'Редактировать' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Удалить шаблон' })).toBeNull();
  });

  it('меню «⋯» закрывается, когда курсор уходит с карточки', () => {
    setup();
    const card = cardOf('Буква и слова на неё');
    fireEvent.click(within(card).getByRole('button', { name: 'Действия с шаблоном' }));
    expect(screen.getByRole('menuitem', { name: 'Дублировать' })).toBeTruthy();
    fireEvent.mouseLeave(card);
    expect(screen.queryByRole('menuitem', { name: 'Дублировать' })).toBeNull();
  });

  it('«Открыть» открывает шаблон на канвасе', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus() {} } as Window);
    setup();
    fireEvent.click(within(cardOf('Буква и слова на неё')).getByRole('button', { name: 'Открыть' }));
    expect(open).toHaveBeenCalledWith('/app/template/p-t2', '_blank');
    open.mockRestore();
  });

  it('мета карточки: тема, возраст, источник', () => {
    setup();
    expect(within(cardOf('Буква и слова на неё')).getByText(/Анна Петрова/)).toBeTruthy();
    expect(within(cardOf('Счёт до 5 с яблоками')).queryByText(/Blanko/)).toBeNull();
    expect(cardOf('Счёт до 5 с яблоками').querySelector('.tpl-card__meta')?.textContent).toBe('Математика · 3-4 года');
    expect(within(cardOf('Времена года')).getByText(/все возрасты/)).toBeTruthy();
  });

  it('«Только наши» прячет предустановленные, «Сбросить фильтры» возвращает', () => {
    setup();
    const chip = screen.getByRole('button', { name: 'Только наши' });
    expect(chip.textContent).toBe('Только наши');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(found()).toBe('Найдено: 1');
    expect(screen.getByText('Буква и слова на неё', { selector: '.tpl-card__title' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    expect(found()).toBe('Найдено: 4');
  });


  it('поиск «буква» оставляет одну карточку', () => {
    setup();
    fireEvent.change(screen.getByRole('textbox', { name: /Поиск/ }), { target: { value: 'буква' } });
    expect(found()).toBe('Найдено: 1');
  });

  it('без группы «Создать доску» недоступна', () => {
    setup({ team: null });
    const btn = within(cardOf('Счёт до 5 с яблоками')).getByRole('button', { name: 'Создать доску' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('пока список грузится, «нет шаблонов» не показывается', () => {
    setup({ templates: [], loading: true });
    expect(screen.getByText('Загружаем шаблоны…')).toBeTruthy();
    expect(screen.queryByText(/Таких шаблонов нет/)).toBeNull();
    expect(screen.queryByText(/Шаблонов пока нет/)).toBeNull();
  });

  it('ошибка загрузки: сообщение и «Повторить»', () => {
    const { tpls } = setup({ templates: [], error: 'boom' });
    expect(screen.getByText('Не удалось загрузить шаблоны')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(tpls.refresh).toHaveBeenCalled();
    expect(screen.queryByText(/Шаблонов пока нет/)).toBeNull();
  });

  it('шаблонов нет совсем', () => {
    setup({ templates: [] });
    expect(screen.getByText(/Шаблонов пока нет/)).toBeTruthy();
  });
});
