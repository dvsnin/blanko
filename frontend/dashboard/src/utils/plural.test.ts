import { describe, it, expect } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it.each([
    [0, '0 досок'], [1, '1 доска'], [2, '2 доски'], [5, '5 досок'],
    [11, '11 досок'], [12, '12 досок'], [21, '21 доска'], [22, '22 доски'], [111, '111 досок'],
  ])('%i → %s', (n, expected) => {
    expect(plural(n, 'доска', 'доски', 'досок')).toBe(expected);
  });
});
