import { COVER_KEYS, colorForId, hashString, type CoverKey } from "./cover";

export { colorForId, COVER_KEYS } from "./cover";

/** Цвет из colorKey (если проставлен assignColors), иначе из id. */
export function colorOf(item: { id: string; colorKey?: string }): CoverKey {
  return item.colorKey && (COVER_KEYS as readonly string[]).includes(item.colorKey) ? (item.colorKey as CoverKey) : colorForId(item.id);
}

/** colorKey без повторов внутри списка (пока хватает цветов); порядок обхода по id, шаг коллизии 5. */
export function assignColors<T extends { id: string; colorKey?: string }>(list: T[]): T[] {
  const n = COVER_KEYS.length;
  const taken = new Set<number>();
  const byId = new Map<string, string>();
  const ids = [...new Set(list.map((b) => b.id))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const id of ids) {
    let idx = hashString(id) % n;
    for (let i = 0; i < n && taken.has(idx); i++) idx = (idx + 5) % n;
    taken.add(idx);
    byId.set(id, COVER_KEYS[idx]);
  }
  // Объект с уже верным цветом возвращается как есть: мемоизированные карточки не перерисовываются.
  return list.map((b) => {
    const colorKey = byId.get(b.id);
    return b.colorKey === colorKey ? b : { ...b, colorKey };
  });
}
