import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import BoardCover from './BoardCover';
import css from './BoardCover.css?raw';
import { COVER_KEYS, coverFor } from '../utils/cover';
import { FIXTURE } from '../utils/templates.fixture';

const board = { id: 'b1', title: 'Счёт до 5', owner: 'Анна Петрова', ownerId: 'u1' };

describe('BoardCover', () => {
  afterEach(cleanup);

  it('card: класс цвета и фигура, без глифа и без чипа темы', () => {
    const { container } = render(<BoardCover board={board} size="card" template={FIXTURE[1]} />);
    const c = coverFor(board);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain(`cover--${c.colorKey}`);
    expect(root.className).toContain('board-cover--card');
    expect(container.querySelector(`.board-cover__shape--${c.shape}.board-cover__shape--corner-${c.corner}`)).not.toBeNull();
    expect(container.querySelector('.board-cover__glyph')).toBeNull();
    expect(container.querySelector('.board-cover__topic')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('small: та же плитка меньшего размера', () => {
    const { container } = render(<BoardCover board={board} size="small" />);
    expect(container.querySelector('.board-cover--small')).not.toBeNull();
    expect(container.querySelector('.board-cover__glyph')).toBeNull();
  });



  it('CSS: у каждого цвета есть правило с тремя переменными', () => {
    for (const key of COVER_KEYS) {
      const m = css.match(new RegExp(`\\.cover--${key}\\s*\\{([^}]*)\\}`));
      expect(m, key).not.toBeNull();
      expect(m![1]).toContain('--cover-bg');
      expect(m![1]).toContain('--cover-accent');
      expect(m![1]).toContain('--cover-ink');
    }
  });
});
