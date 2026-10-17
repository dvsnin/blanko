import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import BoardCover from './BoardCover';
import css from './BoardCover.css?raw';
import { COVER_KEYS, coverFor } from '../utils/cover';
import { FIXTURE } from '../utils/templates.fixture';

const board = { id: 'b1', title: 'Счёт до 5', owner: 'Анна Петрова', ownerId: 'u1' };

describe('BoardCover', () => {
  afterEach(cleanup);

  it('card: глиф, класс цвета, фигура; аватара на обложке нет (он под названием)', () => {
    const { container } = render(<BoardCover board={board} size="card" />);
    const c = coverFor(board);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain(`cover--${c.colorKey}`);
    expect(root.className).toContain('board-cover--card');
    expect(container.querySelector('.board-cover__glyph')?.textContent).toBe('5');
    expect(container.querySelector(`.board-cover__shape--${c.shape}.board-cover__shape--corner-${c.corner}`)).not.toBeNull();
    expect(container.querySelector('.board-cover__author')).toBeNull();
  });
  it('small: без аватара', () => {
    const { container } = render(<BoardCover board={board} size="small" />);
    expect(container.querySelector('.board-cover__author')).toBeNull();
    expect(container.querySelector('.board-cover--small')).not.toBeNull();
  });
  it('card + template: чип темы и глиф из шаблона', () => {
    const { container } = render(<BoardCover board={{ ...board, templateId: 't2' }} size="card" template={FIXTURE[1]} />);
    expect(container.querySelector('.board-cover__topic')?.textContent).toBe('Грамота');
    expect(container.querySelector('.board-cover__glyph')?.textContent).toBe('Б');
  });
  it('без шаблона чипа нет (в том числе у доски с templateId удалённого шаблона)', () => {
    const { container } = render(<BoardCover board={{ ...board, templateId: 'ghost' }} size="card" />);
    expect(container.querySelector('.board-cover__topic')).toBeNull();
    expect(container.querySelector('.board-cover__glyph')?.textContent).toBe('5');
  });
  it('small: чипа нет даже с шаблоном', () => {
    const { container } = render(<BoardCover board={{ ...board, templateId: 't2' }} size="small" template={FIXTURE[1]} />);
    expect(container.querySelector('.board-cover__topic')).toBeNull();
  });
  it('палитра в CSS совпадает с COVER_KEYS', () => {
    for (const key of COVER_KEYS) expect(css).toMatch(new RegExp(`\\.cover--${key}\\s*\\{[^}]*--cover-bg[^}]*--cover-accent[^}]*--cover-ink`));
  });
});
