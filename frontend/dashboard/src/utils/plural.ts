/** Русское склонение: plural(5, 'доска', 'доски', 'досок') → '5 досок'. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const m100 = abs % 100;
  const m10 = abs % 10;
  let word = many;
  if (m100 < 11 || m100 > 14) {
    if (m10 === 1) word = one;
    else if (m10 >= 2 && m10 <= 4) word = few;
  }
  return `${n} ${word}`;
}
