import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
// @ts-expect-error: no @types/node in this project; vitest runs on node
import { readFileSync } from 'node:fs';
import BoardCover from './BoardCover';
import { COVER_KEYS, coverFor, colorForId } from '../utils/cover';

const board = { id: 'b1', title: 'Счёт до 5', owner: 'Анна Петрова', ownerId: 'u1' };

describe('BoardCover', () => {
  afterEach(cleanup);

  it('card: глиф, класс цвета, фигура, аватар', () => {
    const { container, getByTitle } = render(<BoardCover board={board} size="card" />);
    const c = coverFor(board);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain(`cover--${c.colorKey}`);
    expect(root.className).toContain('board-cover--card');
    expect(container.querySelector('.board-cover__glyph')?.textContent).toBe('5');
    expect(container.querySelector(`.board-cover__shape--${c.shape}.board-cover__shape--corner-${c.corner}`)).not.toBeNull();
    const author = getByTitle('Анна Петрова');
    expect(author.textContent).toBe('АП');
    expect(author.className).toContain(`cover--${colorForId('u1')}`);
  });
  it('small: без аватара', () => {
    const { container } = render(<BoardCover board={board} size="small" />);
    expect(container.querySelector('.board-cover__author')).toBeNull();
    expect(container.querySelector('.board-cover--small')).not.toBeNull();
  });
  it('без ownerId: аватар по имени, без исключения', () => {
    const { getByTitle } = render(<BoardCover board={{ ...board, ownerId: undefined }} size="card" />);
    expect(getByTitle('Анна Петрова').className).toContain(`cover--${colorForId('Анна Петрова')}`);
  });
  it('палитра в CSS совпадает с COVER_KEYS', () => {
    // jsdom makes import.meta.url non-file, so resolve via cwd (vitest runs from frontend/dashboard)
    const css = readFileSync('src/components/BoardCover.css', 'utf8');
    for (const key of COVER_KEYS) expect(css).toMatch(new RegExp(`\\.cover--${key}\\s*\\{[^}]*--cover-bg[^}]*--cover-accent[^}]*--cover-ink`));
  });
});
