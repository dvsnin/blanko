export const COVER_KEYS = [
  'butter', 'peach', 'lime', 'mint', 'sky', 'lavender', 'rose', 'apricot',
  'olive', 'aqua', 'cobalt', 'violet', 'cherry', 'lemon', 'grass', 'ice',
  'periwinkle', 'orchid', 'clay', 'sand', 'sage', 'steel', 'plum', 'coral',
] as const;

export type CoverKey = (typeof COVER_KEYS)[number];
export type CoverShape = 'circle' | 'square' | 'triangle';
export type CoverCorner = 0 | 1 | 2 | 3;

export interface Cover {
  colorKey: CoverKey;
  shape: CoverShape;
  corner: CoverCorner;
  glyph: string;
}

const SHAPES: readonly CoverShape[] = ['circle', 'square', 'triangle'];

const STOP_WORDS = new Set([
  'и', 'в', 'на', 'с', 'по', 'до', 'из', 'у', 'к', 'о', 'для', 'от', 'про', 'за', 'как', 'что', 'кто', 'а', 'но',
]);

const SEPARATORS = /[\s«»"',.:;!?()\-–—]+/;

const FALLBACK_GLYPH = 'Д';

/** FNV-1a 32-bit с финальным перемешиванием; результат — uint32. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function colorForId(id: string): CoverKey {
  if (!id) return COVER_KEYS[0];
  return COVER_KEYS[hashString(id) % COVER_KEYS.length];
}

export function glyphFromTitle(title: string): string {
  const t = title.trim();

  const num = t.match(/\d+/);
  if (num) return num[0].slice(0, 2);

  for (const word of t.split(SEPARATORS)) {
    if (!word || STOP_WORDS.has(word.toLowerCase())) continue;
    const letter = word.match(/\p{L}/u);
    if (letter) return letter[0].toUpperCase();
  }
  return FALLBACK_GLYPH;
}

export function coverFor(board: { id: string; title: string }): Cover {
  const h = hashString(board.id);
  return {
    colorKey: COVER_KEYS[h % COVER_KEYS.length],
    shape: SHAPES[(h >>> 8) % 3],
    corner: ((h >>> 16) % 4) as CoverCorner,
    glyph: glyphFromTitle(board.title),
  };
}

/** Первые буквы первых двух слов имени, в верхнем регистре. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
