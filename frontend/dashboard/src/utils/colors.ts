import type { Board } from "../types";
import { colorForId } from "./cover";

export { colorForId, COVER_KEYS } from "./cover";

/**
 * Проставляет colorKey каждой доске детерминированно по её id.
 * Перезаписывает существующие colorKey, чтобы случайные значения из старых сессий
 * не «перекрывали» стабильную палитру.
 */
export function assignColors(list: Board[]): Board[] {
  return list.map((b) => ({ ...b, colorKey: colorForId(b.id) }));
}
