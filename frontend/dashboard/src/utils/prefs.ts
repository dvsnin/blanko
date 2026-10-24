import { api } from "../api/client";

export type PrefValue = string | number | boolean;

/**
 * Настройки кабинета на аккаунте: сервер кладёт их в window.dashData.prefs при рендере страницы,
 * так что первый кадр уже с нужной группой и фильтрами. Запись идёт с задержкой одной склеенной
 * пачкой и не блокирует интерфейс; локальная копия обновляется сразу.
 */
const DELAY_MS = 300;
let pending: Record<string, PrefValue | null> = {};
let timer: ReturnType<typeof setTimeout> | null = null;

export function readPref(key: string): PrefValue | undefined {
  const v = window.dashData?.prefs?.[key];
  return v === null ? undefined : v;
}

/** Значение из настроек, если оно входит в список допустимых, иначе fallback. */
export function readPrefIn<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = readPref(key);
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function savePrefs(set: Record<string, PrefValue | null>): void {
  const dash = window.dashData;
  if (!dash) return;
  const prefs = { ...(dash.prefs ?? {}) };
  for (const [k, v] of Object.entries(set)) {
    if (v === null) delete prefs[k]; else prefs[k] = v;
  }
  dash.prefs = prefs;
  pending = { ...pending, ...set };
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushPrefs, DELAY_MS);
}

/** Отправить накопленное сейчас (уход со страницы, тесты). */
export function flushPrefs(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  const batch = pending;
  pending = {};
  if (Object.keys(batch).length === 0) return;
  api.account.updatePrefs(batch).catch((e) => console.warn("prefs: save failed", e));
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPrefs);
}
