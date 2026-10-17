import type { Board } from "../types";
import { COVER_KEYS, hashString } from "./cover";

export { colorForId, COVER_KEYS } from "./cover";

/**
 * Проставляет colorKey каждой доске детерминированно и без повторов внутри списка
 * (пока хватает цветов). Порядок обработки — по id, не зависит от порядка входа;
 * при коллизии шаг по палитре равен 5 (взаимно прост с 12).
 */
export function assignColors(list: Board[]): Board[] {
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
  return list.map((b) => ({ ...b, colorKey: byId.get(b.id) }));
}
