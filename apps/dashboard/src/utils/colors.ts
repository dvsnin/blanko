import type { Board } from "../types";

export const COLOR_KEYS = [
  "mintBlue", "peach", "lilac", "aqua", "sunset",
  "grass", "ocean", "berry", "grape", "night",
  "lava", "sky", "forest", "lemon", "rose",
  "steel", "sand", "teal", "freshMint", "indigo",
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

export function pickAvailableColor(boards: Board[]): string {
  const used = new Set(boards.map((b) => b.colorKey).filter(Boolean));
  for (const key of COLOR_KEYS) {
    if (!used.has(key)) return key;
  }
  return COLOR_KEYS[boards.length % COLOR_KEYS.length];
}

export function assignColors(list: Board[]): Board[] {
  const out: Board[] = [];
  const used = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const b = { ...list[i] };
    if (!b.colorKey) {
      const available = COLOR_KEYS.find((k) => !used.has(k));
      b.colorKey = available || COLOR_KEYS[i % COLOR_KEYS.length];
    }
    used.add(b.colorKey);
    out.push(b);
  }
  return out;
}
