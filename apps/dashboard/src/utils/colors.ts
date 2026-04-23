import type { Board } from "../types";

export const COLOR_KEYS = [
  "mintBlue", "peach", "lilac", "aqua", "sunset",
  "grass", "ocean", "berry", "grape", "night",
  "lava", "sky", "forest", "lemon", "rose",
  "steel", "sand", "teal", "freshMint", "indigo",
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

/**
 * Детерминированный хеш строки (FNV-1a, 32-bit).
 * Нужен, чтобы один и тот же id всегда маппился в один и тот же цвет
 * между рендерами / перезагрузками страницы.
 */
function hashString(s: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Стабильный цвет для доски по её id. */
export function colorForId(id: string): string {
  if (!id) return COLOR_KEYS[0];
  return COLOR_KEYS[hashString(id) % COLOR_KEYS.length];
}

/** Возвращает цвет с учётом уже занятых соседями — сейчас просто стабильный hash. */
export function pickAvailableColor(boards: Board[], id?: string): string {
  if (id) return colorForId(id);
  // fallback для вызовов без id (чтобы не ломать контракт)
  const used = new Set(boards.map((b) => b.colorKey).filter(Boolean));
  for (const key of COLOR_KEYS) {
    if (!used.has(key)) return key;
  }
  return COLOR_KEYS[boards.length % COLOR_KEYS.length];
}

/**
 * Проставляет colorKey каждой доске детерминированно по её id.
 * Перезаписывает существующие colorKey, чтобы случайные значения из старых сессий
 * не «перекрывали» стабильную палитру.
 */
export function assignColors(list: Board[]): Board[] {
  return list.map((b) => ({ ...b, colorKey: colorForId(b.id) }));
}
